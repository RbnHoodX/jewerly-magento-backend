import 'dotenv/config'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SyncConfig } from './types'

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
      logDir: process.env.LOG_DIR || './logs',
      concurrency: parseInt(process.env.SYNC_CONCURRENCY || '3'),
      retries: parseInt(process.env.SYNC_RETRIES || '2'),
    }
  }
}

async function findDuplicates() {
  const config = loadConfig()
  const supabase = createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('🔍 Looking for duplicate orders...')

  // Find orders with same customer, date, and total amount
  const { data: duplicates, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_date,
      total_amount,
      customers!inner(email, name),
      order_customer_notes(content)
    `)
    .order('order_date', { ascending: false })

  if (error) {
    console.error('Error fetching orders:', error)
    return
  }

  // Group by customer email, date, and amount
  const groups = new Map<string, any[]>()
  
  for (const order of duplicates || []) {
    const key = `${order.customers.email}-${order.order_date}-${order.total_amount}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(order)
  }

  // Find groups with more than one order
  const duplicateGroups = Array.from(groups.entries()).filter(([_, orders]) => orders.length > 1)
  
  console.log(`Found ${duplicateGroups.length} groups of potential duplicates:`)
  
  for (const [key, orders] of duplicateGroups) {
    console.log(`\n📦 Group: ${key}`)
    console.log(`   Orders: ${orders.length}`)
    
    for (const order of orders) {
      const hasShopifyNote = order.order_customer_notes?.some((note: any) => 
        note.content?.includes('Shopify Order:')
      )
      console.log(`   - ${order.id} (${order.customers.name}) - Shopify: ${hasShopifyNote ? 'Yes' : 'No'}`)
    }
  }

  console.log('\n💡 To clean up duplicates:')
  console.log('1. Keep the order with the Shopify note (imported order)')
  console.log('2. Delete the duplicate orders without Shopify notes')
  console.log('3. Re-run the sync to ensure proper import tracking')
}

async function main() {
  try {
    await findDuplicates()
  } catch (error) {
    console.error('Cleanup failed:', error)
    process.exit(1)
  }
}

main()
