import { SupabaseClient } from '@supabase/supabase-js'
import {
  CustomerUpsertData,
  OrderInsertData,
  OrderItemInsertData,
  AddressInsertData,
  Address
} from '../types'

export class DatabaseService {
  constructor(private supabase: SupabaseClient) {}

  async checkOrderExists(shopifyOrderId: string): Promise<boolean> {
    // Check if order already exists by looking for a comment or note that contains the Shopify order ID
    // We'll use the order_customer_notes table to store the Shopify order ID as a reference
    const { data, error } = await this.supabase
      .from('order_customer_notes')
      .select('id')
      .eq('content', `Shopify Order: ${shopifyOrderId}`)
      .limit(1)
      .maybeSingle()
    
    if (error) throw error
    return !!data
  }

  async checkOrderExistsByDetails(
    customerEmail: string, 
    orderDate: string, 
    totalAmount: number
  ): Promise<boolean> {
    // Alternative check: look for orders with same customer, date, and total amount
    const { data, error } = await this.supabase
      .from('orders')
      .select(`
        id,
        customers!inner(email),
        order_date,
        total_amount
      `)
      .eq('customers.email', customerEmail)
      .eq('order_date', orderDate)
      .eq('total_amount', totalAmount)
      .limit(1)
      .maybeSingle()
    
    if (error) throw error
    return !!data
  }

  async markOrderAsImported(orderId: string, shopifyOrderId: string, shopifyOrderName: string): Promise<void> {
    // Create a customer note to mark this order as imported from Shopify
    const { error } = await this.supabase
      .from('order_customer_notes')
      .insert({
        order_id: orderId,
        content: `Shopify Order: ${shopifyOrderId} (${shopifyOrderName})`,
        status: 'imported'
      })
    
    if (error) throw error
  }

  async upsertCustomer(customerData: CustomerUpsertData): Promise<string | undefined> {
    const { email, ...payload } = customerData
    
    if (!email) return undefined

    // Check if customer exists
    const { data: existing } = await this.supabase
      .from('customers')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing?.id) {
      // Update existing customer with new address info
      const { error: updateErr } = await this.supabase
        .from('customers')
        .update(payload)
        .eq('id', existing.id)
      if (updateErr) throw updateErr
      return existing.id
    } else {
      // Insert new customer
      const { data: ins, error: insErr } = await this.supabase
        .from('customers')
        .insert({ email, ...payload })
        .select('id')
        .single()
      if (insErr) throw insErr
      return ins.id
    }
  }

  async createOrder(orderData: OrderInsertData): Promise<string> {
    const { data: newOrder, error: orderErr } = await this.supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single()
    if (orderErr) throw orderErr
    return newOrder.id
  }

  async createOrderItems(items: OrderItemInsertData[]): Promise<void> {
    if (items.length === 0) return
    
    const { error: itemErr } = await this.supabase
      .from('order_items')
      .insert(items)
    if (itemErr) throw itemErr
  }

  async upsertBillingAddress(addressData: AddressInsertData): Promise<void> {
    const { error } = await this.supabase
      .from('order_billing_address')
      .upsert(addressData, { onConflict: 'order_id' })
    if (error) throw error
  }

  async upsertShippingAddress(addressData: AddressInsertData): Promise<void> {
    const { error } = await this.supabase
      .from('order_shipping_address')
      .upsert(addressData, { onConflict: 'order_id' })
    if (error) throw error
  }

  async createCompleteOrder(
    customerData: CustomerUpsertData,
    orderData: OrderInsertData,
    items: OrderItemInsertData[],
    billingAddress?: AddressInsertData,
    shippingAddress?: AddressInsertData
  ): Promise<string> {
    // Upsert customer
    const customerId = await this.upsertCustomer(customerData)
    
    // Create order with customer reference
    const orderWithCustomer = { ...orderData, customer_id: customerId }
    const orderId = await this.createOrder(orderWithCustomer)

    // Create order items
    const orderItems = items.map(item => ({ ...item, order_id: orderId }))
    await this.createOrderItems(orderItems)

    // Create addresses if provided
    if (billingAddress) {
      await this.upsertBillingAddress({ ...billingAddress, order_id: orderId })
    }
    
    if (shippingAddress) {
      await this.upsertShippingAddress({ ...shippingAddress, order_id: orderId })
    }

    return orderId
  }

  async updateCompleteOrder(
    orderId: string,
    customerData: CustomerUpsertData,
    orderData: OrderInsertData,
    items: OrderItemInsertData[],
    billingAddress?: AddressInsertData,
    shippingAddress?: AddressInsertData
  ): Promise<void> {
    // Update customer if email exists
    if (customerData.email) {
      await this.upsertCustomer(customerData)
    }
    
    // Update order data
    const { error: orderError } = await this.supabase
      .from('orders')
      .update(orderData)
      .eq('id', orderId)
    
    if (orderError) throw orderError

    // Delete existing items and recreate
    const { error: deleteItemsError } = await this.supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
    
    if (deleteItemsError) throw deleteItemsError

    // Insert new items
    const orderItems = items.map(item => ({ ...item, order_id: orderId }))
    await this.createOrderItems(orderItems)

    // Update addresses if provided
    if (billingAddress) {
      await this.upsertBillingAddress({ ...billingAddress, order_id: orderId })
    }
    
    if (shippingAddress) {
      await this.upsertShippingAddress({ ...shippingAddress, order_id: orderId })
    }
  }

  async getOrderIdByShopifyId(shopifyOrderId: string): Promise<string | null> {
    // Find order ID by looking for the Shopify tracking note
    const { data, error } = await this.supabase
      .from('order_customer_notes')
      .select('order_id')
      .eq('content', `Shopify Order: ${shopifyOrderId}`)
      .limit(1)
      .maybeSingle()
    
    if (error) throw error
    return data?.order_id || null
  }
}
