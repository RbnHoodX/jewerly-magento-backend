import 'dotenv/config'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

function getEnv(name: string, required = true): string | undefined {
  const value = process.env[name]
  if (required && !value) throw new Error(`Missing env ${name}`)
  return value
}

class SupabaseCleanup {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = getEnv('SUPABASE_URL')!
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')!
    
    this.supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async deleteOrderById(orderId: string): Promise<void> {
    console.log(`🗑️ Deleting order ${orderId} and all related data...`)
    
    try {
      // Delete order items
      const { error: itemsError } = await this.supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)
      
      if (itemsError) throw itemsError
      console.log(`   ✅ Deleted order items`)

      // Delete billing address
      const { error: billingError } = await this.supabase
        .from('order_billing_address')
        .delete()
        .eq('order_id', orderId)
      
      if (billingError) throw billingError
      console.log(`   ✅ Deleted billing address`)

      // Delete shipping address
      const { error: shippingError } = await this.supabase
        .from('order_shipping_address')
        .delete()
        .eq('order_id', orderId)
      
      if (shippingError) throw shippingError
      console.log(`   ✅ Deleted shipping address`)

      // Delete customer notes
      const { error: notesError } = await this.supabase
        .from('order_customer_notes')
        .delete()
        .eq('order_id', orderId)
      
      if (notesError) throw notesError
      console.log(`   ✅ Deleted customer notes`)

      // Delete the order itself
      const { error: orderError } = await this.supabase
        .from('orders')
        .delete()
        .eq('id', orderId)
      
      if (orderError) throw orderError
      console.log(`   ✅ Deleted order`)

      console.log(`🎉 Successfully deleted order ${orderId} and all related data`)
    } catch (error) {
      console.error(`❌ Error deleting order ${orderId}:`, error)
      throw error
    }
  }

  async deleteOrdersByShopifyId(shopifyId: string): Promise<void> {
    console.log(`🔍 Finding orders with Shopify ID: ${shopifyId}`)
    
    // Find orders by Shopify tracking note
    const { data: notes, error: notesError } = await this.supabase
      .from('order_customer_notes')
      .select('order_id')
      .ilike('content', `Shopify Order: ${shopifyId}%`)
    
    if (notesError) throw notesError
    
    if (!notes || notes.length === 0) {
      console.log(`❌ No orders found with Shopify ID: ${shopifyId}`)
      return
    }

    console.log(`📋 Found ${notes.length} order(s) with Shopify ID: ${shopifyId}`)
    
    for (const note of notes) {
      await this.deleteOrderById(note.order_id)
    }
  }

  async deleteOrdersByDateRange(startDate: string, endDate: string): Promise<void> {
    console.log(`🗓️ Deleting orders between ${startDate} and ${endDate}`)
    
    // Get orders in date range
    const { data: orders, error: ordersError } = await this.supabase
      .from('orders')
      .select('id, order_number, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
    
    if (ordersError) throw ordersError
    
    if (!orders || orders.length === 0) {
      console.log(`❌ No orders found in date range`)
      return
    }

    console.log(`📋 Found ${orders.length} order(s) in date range`)
    console.log(`Orders to delete:`)
    orders.forEach(order => {
      console.log(`   - ${order.order_number} (${order.id}) - ${order.created_at}`)
    })

    // Confirm deletion
    console.log(`\n⚠️  WARNING: This will delete ${orders.length} orders and ALL related data!`)
    console.log(`Press Ctrl+C to cancel, or wait 5 seconds to continue...`)
    
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    for (const order of orders) {
      await this.deleteOrderById(order.id)
    }
    
    console.log(`🎉 Successfully deleted ${orders.length} orders`)
  }

  async deleteAllOrders(): Promise<void> {
    console.log(`🚨 DELETING ALL ORDERS AND RELATED DATA!`)
    
    // Get count first
    const { count, error: countError } = await this.supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    
    if (countError) throw countError
    
    console.log(`📊 Found ${count} orders to delete`)
    console.log(`\n⚠️  WARNING: This will delete ALL ${count} orders and ALL related data!`)
    console.log(`Press Ctrl+C to cancel, or wait 10 seconds to continue...`)
    
    await new Promise(resolve => setTimeout(resolve, 10000))
    
    // Delete all order items
    const { error: itemsError } = await this.supabase
      .from('order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (itemsError) throw itemsError
    console.log(`✅ Deleted all order items`)

    // Delete all addresses
    const { error: billingError } = await this.supabase
      .from('order_billing_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (billingError) throw billingError
    console.log(`✅ Deleted all billing addresses`)

    const { error: shippingError } = await this.supabase
      .from('order_shipping_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (shippingError) throw shippingError
    console.log(`✅ Deleted all shipping addresses`)

    // Delete all customer notes
    const { error: notesError } = await this.supabase
      .from('order_customer_notes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (notesError) throw notesError
    console.log(`✅ Deleted all customer notes`)

    // Delete all orders
    const { error: ordersError } = await this.supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    
    if (ordersError) throw ordersError
    console.log(`✅ Deleted all orders`)

    console.log(`🎉 Successfully deleted ALL orders and related data!`)
  }

  async listOrders(limit = 10): Promise<void> {
    console.log(`📋 Listing recent orders (limit: ${limit})`)
    
    const { data: orders, error } = await this.supabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        bill_to_name,
        ship_to_name,
        delivery_method,
        order_customer_notes(content)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) throw error
    
    if (!orders || orders.length === 0) {
      console.log(`❌ No orders found`)
      return
    }

    console.log(`\n📊 Found ${orders.length} orders:`)
    orders.forEach((order, index) => {
      const shopifyNote = order.order_customer_notes?.find((note: any) => 
        note.content?.startsWith('Shopify Order:')
      )
      const shopifyId = shopifyNote ? shopifyNote.content.split(':')[1]?.trim() : 'N/A'
      
      console.log(`\n${index + 1}. Order ${order.id}`)
      console.log(`   ID: ${order.id}`)
      console.log(`   Shopify ID: ${shopifyId}`)
      console.log(`   Created: ${order.created_at}`)
      console.log(`   Total: $${order.total_amount}`)
      console.log(`   Bill To: ${order.bill_to_name || 'N/A'}`)
      console.log(`   Ship To: ${order.ship_to_name || 'N/A'}`)
      console.log(`   Delivery Method: ${order.delivery_method || 'Standard Shipping'}`)
    })
  }

  async getOrderStats(): Promise<void> {
    console.log(`📊 Getting order statistics...`)
    
    // Total orders
    const { count: totalOrders, error: ordersError } = await this.supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
    
    if (ordersError) throw ordersError

    // Total order items
    const { count: totalItems, error: itemsError } = await this.supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
    
    if (itemsError) throw itemsError

    // Total customers
    const { count: totalCustomers, error: customersError } = await this.supabase
      .from('customers')
      .select('*', { count: 'exact', head: true })
    
    if (customersError) throw customersError

    // Shopify orders (with tracking notes)
    const { data: shopifyNotes, error: notesError } = await this.supabase
      .from('order_customer_notes')
      .select('order_id')
      .ilike('content', 'Shopify Order:%')
    
    if (notesError) throw notesError

    console.log(`\n📈 Database Statistics:`)
    console.log(`   Total Orders: ${totalOrders}`)
    console.log(`   Total Order Items: ${totalItems}`)
    console.log(`   Total Customers: ${totalCustomers}`)
    console.log(`   Shopify Orders: ${shopifyNotes?.length || 0}`)
    console.log(`   Non-Shopify Orders: ${(totalOrders || 0) - (shopifyNotes?.length || 0)}`)
  }
}

async function main() {
  const cleanup = new SupabaseCleanup()
  const args = process.argv.slice(2)
  const command = args[0]

  try {
    switch (command) {
      case 'list':
        const limit = args[1] ? parseInt(args[1]) : 10
        await cleanup.listOrders(limit)
        break

      case 'stats':
        await cleanup.getOrderStats()
        break

      case 'delete-order':
        const orderId = args[1]
        if (!orderId) {
          console.error('❌ Please provide order ID: npm run cleanup delete-order <order-id>')
          process.exit(1)
        }
        await cleanup.deleteOrderById(orderId)
        break

      case 'delete-shopify':
        const shopifyId = args[1]
        if (!shopifyId) {
          console.error('❌ Please provide Shopify ID: npm run cleanup delete-shopify <shopify-id>')
          process.exit(1)
        }
        await cleanup.deleteOrdersByShopifyId(shopifyId)
        break

      case 'delete-date-range':
        const startDate = args[1]
        const endDate = args[2]
        if (!startDate || !endDate) {
          console.error('❌ Please provide date range: npm run cleanup delete-date-range <start-date> <end-date>')
          console.error('   Date format: YYYY-MM-DD (e.g., 2025-01-01 2025-01-31)')
          process.exit(1)
        }
        await cleanup.deleteOrdersByDateRange(startDate, endDate)
        break

      case 'delete-all':
        await cleanup.deleteAllOrders()
        break

      default:
        console.log(`🧹 Supabase Cleanup Tool`)
        console.log(`\nUsage:`)
        console.log(`  npm run cleanup list [limit]                    - List recent orders`)
        console.log(`  npm run cleanup stats                           - Show database statistics`)
        console.log(`  npm run cleanup delete-order <order-id>         - Delete specific order`)
        console.log(`  npm run cleanup delete-shopify <shopify-id>     - Delete orders by Shopify ID`)
        console.log(`  npm run cleanup delete-date-range <start> <end> - Delete orders in date range`)
        console.log(`  npm run cleanup delete-all                      - Delete ALL orders (DANGEROUS!)`)
        console.log(`\nExamples:`)
        console.log(`  npm run cleanup list 20`)
        console.log(`  npm run cleanup delete-order abc-123-def-456`)
        console.log(`  npm run cleanup delete-shopify 12345`)
        console.log(`  npm run cleanup delete-date-range 2025-01-01 2025-01-31`)
        break
    }
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

main()
