import 'dotenv/config'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import { promises as fs } from 'fs'
import path from 'path'

type ShopifyOrder = any

function getEnv(name: string, required = true): string | undefined {
  const value = process.env[name]
  if (required && !value) throw new Error(`Missing env ${name}`)
  return value
}

function supabaseAdmin(): SupabaseClient {
  const url = getEnv('SUPABASE_URL')!
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')!
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Simple structured logger with file output
type LogLevel = 'debug' | 'info' | 'warn' | 'error'
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs')

function levelNum(l: LogLevel) {
  return { debug: 10, info: 20, warn: 30, error: 40 }[l]
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function log(level: LogLevel, msg: string, meta?: any) {
  if (levelNum(level) < levelNum(LOG_LEVEL)) return
  const line = { ts: new Date().toISOString(), level, msg, ...((meta && { meta })) }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line))
}

async function writeJson(filepath: string, data: unknown) {
  await ensureDir(path.dirname(filepath))
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8')
}

async function fetchTaggedOrders(since?: string): Promise<ShopifyOrder[]> {
  const store = getEnv('SHOPIFY_STORE_DOMAIN')!
  const version = getEnv('SHOPIFY_API_VERSION')!
  const token = getEnv('SHOPIFY_ADMIN_ACCESS_TOKEN')!
  const importTag = getEnv('SHOPIFY_IMPORT_TAG')!

  const limit = 250
  let url = `https://${store}/admin/api/${version}/orders.json?status=any&limit=${limit}&fields=id,name,created_at,customer,current_total_price,financial_status,fulfillment_status,shipping_address,billing_address,line_items,tags,email,phone`
  // Use orders with tag filter
  url += `&tag=${encodeURIComponent(importTag)}`
  if (since) url += `&created_at_min=${encodeURIComponent(since)}`

  const orders: ShopifyOrder[] = []
  let nextLink: string | undefined

  while (true) {
    const res = await fetch(nextLink ?? url, {
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) throw new Error(`Shopify fetch failed: ${res.status} ${res.statusText}`)
    const data = (await res.json()) as { orders: ShopifyOrder[] }
    orders.push(...(data.orders ?? []))

    const link = res.headers.get('link')
    if (!link || !link.includes('rel="next"')) break
    const match = /<([^>]+)>; rel="next"/.exec(link)
    nextLink = match?.[1]
    if (!nextLink) break
  }
  return orders
}

async function hasImported(supabase: SupabaseClient, shopifyOrderId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('shopify_imports')
    .select('id')
    .eq('shopify_order_id', String(shopifyOrderId))
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return !!data
}

async function upsertCustomerAndOrder(supabase: SupabaseClient, order: ShopifyOrder) {
  const email = order?.email || order?.customer?.email
  const customerPayload: any = {
    email,
    name: order?.customer ? `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim() : undefined,
    first_name: order?.customer?.first_name ?? null,
    last_name: order?.customer?.last_name ?? null,
    phone: order?.customer?.phone ?? order?.phone ?? null,
  }
  // Upsert customer by email
  let customerId: string | undefined
  if (email) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (existing?.id) {
      customerId = existing.id
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('customers')
        .insert({ email, ...customerPayload })
        .select('id')
        .single()
      if (insErr) throw insErr
      customerId = ins.id
    }
  }

  // Insert order core
  const orderPayload: any = {
    customer_id: customerId ?? null,
    purchase_from: 'primestyle',
    order_date: order.created_at,
    total_amount: Number(order.current_total_price ?? 0),
  }
  const { data: newOrder, error: orderErr } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select('id')
    .single()
  if (orderErr) throw orderErr

  const orderId: string = newOrder.id

  // Upsert addresses
  if (order.billing_address) {
    const b = order.billing_address
    await supabase.from('order_billing_address').upsert({
      order_id: orderId,
      first_name: b.first_name ?? null,
      last_name: b.last_name ?? null,
      address1: b.address1 ?? null,
      address2: b.address2 ?? null,
      city: b.city ?? null,
      state: b.province ?? null,
      postal_code: b.zip ?? null,
      country: b.country ?? null,
      phone: b.phone ?? null,
    }, { onConflict: 'order_id' } as any)
  }
  if (order.shipping_address) {
    const s = order.shipping_address
    await supabase.from('order_shipping_address').upsert({
      order_id: orderId,
      first_name: s.first_name ?? null,
      last_name: s.last_name ?? null,
      address1: s.address1 ?? null,
      address2: s.address2 ?? null,
      city: s.city ?? null,
      state: s.province ?? null,
      postal_code: s.zip ?? null,
      country: s.country ?? null,
      phone: s.phone ?? null,
    }, { onConflict: 'order_id' } as any)
  }

  // Insert items
  const items = order.line_items ?? []
  if (items.length) {
    const rows = items.map((li: any) => ({
      order_id: orderId,
      sku: li.sku || li.variant_id || String(li.id),
      details: li.title ?? null,
      price: Number(li.price ?? 0),
      qty: Number(li.quantity ?? 1),
    }))
    const { error: itemErr } = await supabase.from('order_items').insert(rows)
    if (itemErr) throw itemErr
  }

  return orderId
}

async function writeImportLog(
  supabase: SupabaseClient,
  shopifyOrderId: string,
  shopifyOrderName: string | undefined,
  orderId: string,
  status: 'completed' | 'failed',
  error?: string,
) {
  const { error: logErr } = await supabase.from('shopify_imports').insert({
    shopify_order_id: String(shopifyOrderId),
    shopify_order_name: shopifyOrderName,
    order_id: orderId,
    status,
    error: error ?? null,
  })
  if (logErr) throw logErr
}

async function retagOrder(orderId: string) {
  const store = getEnv('SHOPIFY_STORE_DOMAIN')!
  const version = getEnv('SHOPIFY_API_VERSION')!
  const token = getEnv('SHOPIFY_ADMIN_ACCESS_TOKEN')!
  const processedTag = getEnv('SHOPIFY_PROCESSED_TAG')!
  const importTag = getEnv('SHOPIFY_IMPORT_TAG')!

  // Fetch existing tags
  const orderRes = await fetch(`https://${store}/admin/api/${version}/orders/${orderId}.json`, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
  })
  if (!orderRes.ok) throw new Error(`Fetch order for retag failed: ${orderRes.status}`)
  const order = (await orderRes.json()).order as ShopifyOrder
  const tags: string[] = (order.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
  const newTags = Array.from(new Set(tags.filter(t => t.toLowerCase() !== importTag.toLowerCase()).concat([processedTag])))

  const res = await fetch(`https://${store}/admin/api/${version}/orders/${orderId}.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order: { id: orderId, tags: newTags.join(', ') } })
  })
  if (!res.ok) throw new Error(`Retag failed: ${res.status} ${res.statusText}`)
}

async function runOnce() {
  const since = process.env.SYNC_SINCE
  const supabase = supabaseAdmin()
  const runId = new Date().toISOString().replace(/[:.]/g, '-')
  const shopifyOrders = await fetchTaggedOrders(since)
  log('info', 'Fetched tagged orders', { count: shopifyOrders.length, since })
  await writeJson(path.join(LOG_DIR, `${runId}-fetched-orders.json`), {
    runId,
    since,
    count: shopifyOrders.length,
    orderIds: shopifyOrders.map(o => o.id),
  })

  const queue = new PQueue({ concurrency: 3 })

  await queue.addAll(shopifyOrders.map((o) => async () => {
    const shopifyId = String(o.id)
    const already = await hasImported(supabase, shopifyId)
    if (already) {
      log('info', 'Skipping already imported order', { shopifyId, name: o.name })
      await writeJson(path.join(LOG_DIR, 'orders', `${runId}-${shopifyId}-skipped.json`), {
        runId,
        reason: 'already_imported',
        shopifyId,
        name: o.name,
      })
      return
    }

    try {
      const orderId = await pRetry(() => upsertCustomerAndOrder(supabase, o), { retries: 2 })
      await pRetry(() => writeImportLog(supabase, shopifyId, o.name, orderId, 'completed'), { retries: 2 })
      await pRetry(() => retagOrder(shopifyId), { retries: 2 })
      log('info', 'Imported order', { shopifyId, name: o.name, orderId })
      await writeJson(path.join(LOG_DIR, 'orders', `${runId}-${shopifyId}-success.json`), {
        runId,
        shopifyId,
        name: o.name,
        orderId,
        summary: {
          created_at: o.created_at,
          email: o.email,
          line_items_count: (o.line_items || []).length,
          total: o.current_total_price,
          tags: o.tags,
        },
      })
    } catch (err: any) {
      log('error', 'Failed to import order', { shopifyId, name: o.name, error: err?.message || String(err) })
      // Log failure without order_id
      try {
        await writeImportLog(supabase, shopifyId, o.name, null as any, 'failed', err?.message || String(err))
      } catch (e) {
        log('error', 'Failed writing import log', { shopifyId, error: (e as any)?.message || String(e) })
      }
      await writeJson(path.join(LOG_DIR, 'orders', `${runId}-${shopifyId}-error.json`), {
        runId,
        shopifyId,
        name: o.name,
        error: err?.message || String(err),
        snapshot: {
          created_at: o.created_at,
          email: o.email,
          line_items_count: (o.line_items || []).length,
          total: o.current_total_price,
          tags: o.tags,
        },
      })
    }
  }))
}

async function main() {
  const once = process.argv.includes('--once')
  if (once) {
    await runOnce()
    return
  }
  const intervalMs = 1000 * 60 * 30 // 30 minutes default
  log('info', 'Starting Shopify sync daemon...', { intervalMinutes: 30 })
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const started = new Date()
    try {
      await runOnce()
    } catch (e) {
      log('error', 'Sync pass failed', { error: (e as any)?.message || String(e) })
    }
    const took = (Date.now() - started.getTime()) / 1000
    log('info', 'Sync pass finished', { seconds: Number(took.toFixed(1)) })
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


