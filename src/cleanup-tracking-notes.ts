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

async function cleanupDuplicateTrackingNotes() {
  const config = loadConfig()
  const supabase = createSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('🧹 Cleaning up duplicate tracking notes...')

  // Find all tracking notes
  const { data: notes, error } = await supabase
    .from('order_customer_notes')
    .select('id, order_id, content, created_at')
    .like('content', 'Shopify Order:%')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching notes:', error)
    return
  }

  // Group by order_id
  const notesByOrder = new Map<string, any[]>()
  
  for (const note of notes || []) {
    if (!notesByOrder.has(note.order_id)) {
      notesByOrder.set(note.order_id, [])
    }
    notesByOrder.get(note.order_id)!.push(note)
  }

  // Find orders with multiple tracking notes
  const duplicateGroups = Array.from(notesByOrder.entries()).filter(([_, notes]) => notes.length > 1)
  
  console.log(`Found ${duplicateGroups.length} orders with duplicate tracking notes`)

  let deletedCount = 0

  for (const [orderId, orderNotes] of duplicateGroups) {
    console.log(`\n📦 Order ${orderId}:`)
    console.log(`   Notes: ${orderNotes.length}`)
    
    // Keep the most recent note, delete the rest
    const sortedNotes = orderNotes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const keepNote = sortedNotes[0]
    const deleteNotes = sortedNotes.slice(1)
    
    console.log(`   Keeping: ${keepNote.id} (${keepNote.content})`)
    
    for (const note of deleteNotes) {
      console.log(`   Deleting: ${note.id} (${note.content})`)
      
      const { error: deleteError } = await supabase
        .from('order_customer_notes')
        .delete()
        .eq('id', note.id)
      
      if (deleteError) {
        console.error(`   Error deleting note ${note.id}:`, deleteError)
      } else {
        deletedCount++
      }
    }
  }

  console.log(`\n✅ Cleanup completed. Deleted ${deletedCount} duplicate tracking notes.`)
}

async function main() {
  try {
    await cleanupDuplicateTrackingNotes()
  } catch (error) {
    console.error('Cleanup failed:', error)
    process.exit(1)
  }
}

main()
