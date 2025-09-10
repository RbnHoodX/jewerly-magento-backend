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

// Idempotency strategy: rely on Shopify tag workflow.
// We fetch only orders with the import tag; after a successful import,
// we retag the order so it won't be fetched again. No DB tracking table used.

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
    // orders.order_date is DATE, not timestamp
    order_date: (order.created_at ? String(order.created_at).slice(0, 10) : null),
    total_amount: Number(order.current_total_price ?? 0),
    bill_to_name: (() => {
      const b = order.billing_address
      if (b?.first_name || b?.last_name) return `${b.first_name ?? ''} ${b.last_name ?? ''}`.trim() || null
      if (order.customer?.first_name || order.customer?.last_name) return `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim() || null
      return order.customer?.email ?? null
    })(),
    ship_to_name: (() => {
      const s = order.shipping_address
      if (s?.first_name || s?.last_name) return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || null
      if (order.customer?.first_name || order.customer?.last_name) return `${order.customer.first_name ?? ''} ${order.customer.last_name ?? ''}`.trim() || null
      return order.customer?.email ?? null
    })(),
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
      company: b.company ?? null,
      street1: b.address1 ?? null,
      street2: b.address2 ?? null,
      city: b.city ?? null,
      region: b.province ?? null,
      postcode: b.zip ?? null,
      country: b.country ?? null,
      phone: b.phone ?? null,
      email: order.email ?? null,
    } as any)
  }
  if (order.shipping_address) {
    const s = order.shipping_address
    await supabase.from('order_shipping_address').upsert({
      order_id: orderId,
      first_name: s.first_name ?? null,
      last_name: s.last_name ?? null,
      company: s.company ?? null,
      street1: s.address1 ?? null,
      street2: s.address2 ?? null,
      city: s.city ?? null,
      region: s.province ?? null,
      postcode: s.zip ?? null,
      country: s.country ?? null,
      phone: s.phone ?? null,
      email: order.email ?? null,
    } as any)
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

// No DB import log; file logs capture success/skip/error per order

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
  const json = (await orderRes.json()) as { order?: ShopifyOrder }
  const order = json.order as ShopifyOrder
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
    // No DB check for already imported; tag-based idempotency only

    try {
      const orderId = await pRetry(() => upsertCustomerAndOrder(supabase, o), { retries: 2 })
      // Retagging disabled due to read-only Shopify permissions
      // await pRetry(() => retagOrder(shopifyId), { retries: 2 })
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


