import 'dotenv/config'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import { promises as fs } from 'fs'
import path from 'path'
import { SyncConfig, ShopifyOrder } from './types'
import { DatabaseService } from './services/database'
import { ShopifyService } from './services/shopify'
import { SyncService } from './services/sync'

function getEnv(name: string, required = true): string | undefined {
  const value = process.env[name]
  if (required && !value) throw new Error(`Missing env ${name}`)
  return value
}

function loadConfig(): SyncConfig {
  return {
    shopify: {
      storeDomain: getEnv('SHOPIFY_STORE_DOMAIN')!,
      apiVersion: getEnv('SHOPIFY_API_VERSION')!,
      accessToken: getEnv('SHOPIFY_ADMIN_ACCESS_TOKEN')!,
      importTag: getEnv('SHOPIFY_IMPORT_TAG')!,
      processedTag: getEnv('SHOPIFY_PROCESSED_TAG')!,
    },
    supabase: {
      url: getEnv('SUPABASE_URL')!,
      serviceRoleKey: getEnv('SUPABASE_SERVICE_ROLE_KEY')!,
    },
    sync: {
      since: process.env.SYNC_SINCE,
      logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
      logDir: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
      concurrency: parseInt(process.env.SYNC_CONCURRENCY || '3'),
      retries: parseInt(process.env.SYNC_RETRIES || '2'),
    }
  }
}

function supabaseAdmin(config: SyncConfig): SupabaseClient {
  return createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Simple structured logger with file output
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function levelNum(l: LogLevel) {
  return { debug: 10, info: 20, warn: 30, error: 40 }[l]
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

function createLogger(config: SyncConfig) {
  return {
    log: (level: LogLevel, msg: string, meta?: any) => {
      if (levelNum(level) < levelNum(config.sync.logLevel)) return
      const line = { ts: new Date().toISOString(), level, msg, ...((meta && { meta })) }
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(line))
    },
    writeJson: async (filepath: string, data: unknown) => {
      await ensureDir(path.dirname(filepath))
      await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf8')
    }
  }
}

async function fetchTaggedOrders(config: SyncConfig): Promise<ShopifyOrder[]> {
  const { storeDomain, apiVersion, accessToken, importTag } = config.shopify
  const { since } = config.sync

  const limit = 250
  let url = `https://${storeDomain}/admin/api/${apiVersion}/orders.json?status=any&limit=${limit}&fields=id,name,created_at,customer,current_total_price,financial_status,fulfillment_status,shipping_address,billing_address,line_items,tags,email,phone`
  // Use orders with tag filter
  url += `&tag=${encodeURIComponent(importTag)}`
  if (since) url += `&created_at_min=${encodeURIComponent(since)}`

  const orders: ShopifyOrder[] = []
  let nextLink: string | undefined

  while (true) {
    const res = await fetch(nextLink ?? url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
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

async function runOnce() {
  const config = loadConfig()
  const logger = createLogger(config)
  const supabase = supabaseAdmin(config)
  const db = new DatabaseService(supabase)
  const shopify = new ShopifyService(
    config.shopify.storeDomain,
    config.shopify.apiVersion,
    config.shopify.accessToken
  )
  const sync = new SyncService(db, shopify, logger, config)

  try {
    // Fetch tagged orders
    const shopifyOrders = await fetchTaggedOrders(config)
    logger.log('info', 'Fetched tagged orders', { 
      count: shopifyOrders.length, 
      since: config.sync.since 
    })

    // Write fetch summary
    const runId = new Date().toISOString().replace(/[:.]/g, '-')
    await logger.writeJson(`${runId}-fetched-orders.json`, {
      runId,
      since: config.sync.since,
      count: shopifyOrders.length,
      orderIds: shopifyOrders.map(o => o.id),
    })

    // Sync orders
    const result = await sync.syncOrders(shopifyOrders)
    
    logger.log('info', 'Sync completed', {
      totalOrders: result.totalOrders,
      successfulImports: result.successfulImports,
      failedImports: result.failedImports,
      skippedOrders: result.skippedOrders
    })

    return result
  } catch (error: any) {
    logger.log('error', 'Sync failed', { error: error?.message || String(error) })
    throw error
  }
}

async function main() {
  const config = loadConfig()
  const logger = createLogger(config)
  
  const once = process.argv.includes('--once')
  if (once) {
    await runOnce()
    return
  }
  
  const intervalMs = 1000 * 60 * 30 // 30 minutes default
  logger.log('info', 'Starting Shopify sync daemon...', { intervalMinutes: 30 })
  
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const started = new Date()
    try {
      await runOnce()
    } catch (e) {
      logger.log('error', 'Sync pass failed', { error: (e as any)?.message || String(e) })
    }
    const took = (Date.now() - started.getTime()) / 1000
    logger.log('info', 'Sync pass finished', { seconds: Number(took.toFixed(1)) })
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


