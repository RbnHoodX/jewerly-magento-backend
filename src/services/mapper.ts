import { ShopifyOrder } from '../types'
import {
  CustomerUpsertData,
  OrderInsertData,
  OrderItemInsertData,
  AddressInsertData,
  Address
} from '../types'

export class DataMapper {
  static mapShopifyToCustomerData(order: ShopifyOrder): CustomerUpsertData {
    const email = order?.email || order?.customer?.email
    const customer = order?.customer

    return {
      email: email || '',
      name: customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : undefined,
      first_name: customer?.first_name ?? null,
      last_name: customer?.last_name ?? null,
      phone: customer?.phone ?? order?.phone ?? null,
      billing_addr: order.billing_address ? this.mapShopifyAddress(order.billing_address) : null,
      shipping_addr: order.shipping_address ? this.mapShopifyAddress(order.shipping_address) : null,
    }
  }

  static mapShopifyToOrderData(order: ShopifyOrder): OrderInsertData {
    // Extract shipping service and cost from fulfillments
    const shippingInfo = this.extractShippingInfo(order)
    
    return {
      purchase_from: 'primestyle',
      order_date: order.created_at ? String(order.created_at).slice(0, 10) : null,
      total_amount: Number(order.current_total_price ?? 0),
      bill_to_name: this.extractName(order.billing_address, order.customer, order.email),
      ship_to_name: this.extractName(order.shipping_address, order.customer, order.email),
      delivery_method: shippingInfo.service || 'Standard Shipping',
      // Only include fields that exist in the database schema
      // order_number: order.name, // TODO: Add this field to database schema
      // notes: order.note || null, // TODO: Add this field to database schema  
      // shipping_service: shippingInfo.service || null, // TODO: Add this field to database schema
      // shipping_cost: shippingInfo.cost || null, // TODO: Add this field to database schema
    }
  }

  static mapShopifyToOrderItems(order: ShopifyOrder, imageUrls?: Map<number, string>): OrderItemInsertData[] {
    const items = order.line_items ?? []
    return items.map((li) => {
      // Extract properties from line item
      const properties = li.properties || []
      const ringSize = this.extractProperty(properties, ['ring size', 'size', 'ring_size'])
      const engraving = this.extractProperty(properties, ['engraving', 'personalization', 'text'])
      const metalType = this.extractProperty(properties, ['metal', 'metal type', 'metal_type'])
      
      // Create specification summary from properties
      const specSummary = properties
        .map(prop => `${prop.name}: ${prop.value}`)
        .join(', ')

      // Get image URL for this line item
      const imageUrl = imageUrls?.get(li.id) || null

      return {
        sku: li.sku || li.variant_id?.toString() || li.id.toString(),
        details: li.title ?? null,
        price: Number(li.price ?? 0),
        qty: Number(li.quantity ?? 1),
        size: ringSize || null,
        metal_type: metalType || null,
        image: imageUrl,
        // Only include fields that exist in the database schema
        // specification_summary: specSummary || null, // TODO: Add this field to database schema
        // engraving: engraving || null, // TODO: Add this field to database schema
      }
    })
  }

  static mapShopifyToBillingAddress(order: ShopifyOrder): AddressInsertData | undefined {
    if (!order.billing_address) return undefined

    const b = order.billing_address
    return {
      first_name: b.first_name || '',
      last_name: b.last_name || '',
      company: b.company || null,
      street1: b.address1 || '',
      street2: b.address2 || null,
      city: b.city || '',
      region: b.province || '',
      postcode: b.zip || '',
      country: b.country || '',
      phone: b.phone || null,
      email: order.email || null,
    }
  }

  static mapShopifyToShippingAddress(order: ShopifyOrder): AddressInsertData | undefined {
    if (!order.shipping_address) return undefined

    const s = order.shipping_address
    return {
      first_name: s.first_name || '',
      last_name: s.last_name || '',
      company: s.company || null,
      street1: s.address1 || '',
      street2: s.address2 || null,
      city: s.city || '',
      region: s.province || '',
      postcode: s.zip || '',
      country: s.country || '',
      phone: s.phone || null,
      email: order.email || null,
    }
  }

  private static mapShopifyAddress(address: any): Address {
    return {
      first_name: address.first_name,
      last_name: address.last_name,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.province,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
    }
  }

  private static extractName(
    address: any,
    customer: any,
    email: string | undefined
  ): string | null {
    // Try address first
    if (address?.first_name || address?.last_name) {
      return `${address.first_name ?? ''} ${address.last_name ?? ''}`.trim() || null
    }
    
    // Fallback to customer
    if (customer?.first_name || customer?.last_name) {
      return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || null
    }
    
    // Last resort: email
    return email || null
  }

  private static extractProperty(
    properties: Array<{ name: string; value: string }>,
    possibleNames: string[]
  ): string | null {
    for (const prop of properties) {
      const propName = prop.name.toLowerCase().trim()
      for (const possibleName of possibleNames) {
        if (propName === possibleName.toLowerCase().trim()) {
          return prop.value
        }
      }
    }
    return null
  }

  private static extractShippingInfo(order: ShopifyOrder): { service: string | null; cost: number | null } {
    const fulfillments = order.fulfillments || []
    
    if (fulfillments.length === 0) {
      return { service: null, cost: null }
    }

    // Get the first fulfillment (most recent)
    const fulfillment = fulfillments[0]
    const service = fulfillment.service || null
    
    // Calculate shipping cost from order totals
    // If total_shipping is 0, it's free shipping
    // If it's 29.99, it's overnight upgrade
    const totalShipping = Number(order.total_shipping || 0)
    const cost = totalShipping > 0 ? totalShipping : null

    return { service, cost }
  }
}
