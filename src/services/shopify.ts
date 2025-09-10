import { ShopifyOrder } from '../types'

export class ShopifyService {
  constructor(
    private storeDomain: string,
    private apiVersion: string,
    private accessToken: string
  ) {}

  async fetchOrder(orderId: string): Promise<ShopifyOrder> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/orders/${orderId}.json`
    
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    })
    
    if (!res.ok) throw new Error(`Fetch order failed: ${res.status}`)
    
    const json = (await res.json()) as { order?: ShopifyOrder }
    return json.order as ShopifyOrder
  }

  async updateOrderTags(orderId: string, tags: string[]): Promise<void> {
    const url = `https://${this.storeDomain}/admin/api/${this.apiVersion}/orders/${orderId}.json`
    
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        order: { 
          id: orderId, 
          tags: tags.join(', ') 
        } 
      })
    })
    
    if (!res.ok) throw new Error(`Update order tags failed: ${res.status} ${res.statusText}`)
  }

  async retagOrder(orderId: string, importTag: string, processedTag: string): Promise<void> {
    // Fetch existing tags
    const order = await this.fetchOrder(orderId)
    const tags: string[] = (order.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
    const newTags = Array.from(new Set(
      tags.filter(t => t.toLowerCase() !== importTag.toLowerCase()).concat([processedTag])
    ))

    await this.updateOrderTags(orderId, newTags)
  }
}
