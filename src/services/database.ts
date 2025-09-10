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
}
