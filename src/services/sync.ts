import { ShopifyOrder, SyncResult, OrderImportResult } from '../types'
import { DatabaseService } from './database'
import { ShopifyService } from './shopify'
import { DataMapper } from './mapper'
import PQueue from 'p-queue'
import pRetry from 'p-retry'

export class SyncService {
  constructor(
    private db: DatabaseService,
    private shopify: ShopifyService,
    private logger: any,
    private config: any
  ) {}

  async syncOrders(orders: ShopifyOrder[]): Promise<SyncResult> {
    const runId = new Date().toISOString().replace(/[:.]/g, '-')
    const results: OrderImportResult[] = []
    const errors: string[] = []

    this.logger.log('info', 'Starting order sync', { 
      runId, 
      totalOrders: orders.length 
    })

    // Create queue for processing orders
    const queue = new PQueue({ concurrency: this.config.sync.concurrency })

    await queue.addAll(orders.map((order) => async () => {
      const shopifyId = String(order.id)
      const result: OrderImportResult = {
        runId,
        shopifyId,
        name: order.name,
        status: 'success'
      }

      try {
        // Map Shopify data to our database format
        const customerData = DataMapper.mapShopifyToCustomerData(order)
        const orderData = DataMapper.mapShopifyToOrderData(order)
        const items = DataMapper.mapShopifyToOrderItems(order)
        const billingAddress = DataMapper.mapShopifyToBillingAddress(order)
        const shippingAddress = DataMapper.mapShopifyToShippingAddress(order)

        // Check if order already exists by Shopify ID
        const existingOrderId = await this.db.getOrderIdByShopifyId(shopifyId)
        
        let orderId: string
        
        if (existingOrderId) {
          // Update existing order
          this.logger.log('info', 'Updating existing order', {
            shopifyId,
            name: order.name,
            orderId: existingOrderId
          })
          
          await pRetry(
            () => this.db.updateCompleteOrder(
              existingOrderId,
              customerData,
              orderData,
              items,
              billingAddress,
              shippingAddress
            ),
            { retries: this.config.sync.retries }
          )
          
          orderId = existingOrderId
          result.status = 'updated'
        } else {
          // Create new order
          this.logger.log('info', 'Creating new order', {
            shopifyId,
            name: order.name
          })
          
          orderId = await pRetry(
            () => this.db.createCompleteOrder(
              customerData,
              orderData,
              items,
              billingAddress,
              shippingAddress
            ),
            { retries: this.config.sync.retries }
          )

          // Mark order as imported to prevent future duplicates
          await this.db.markOrderAsImported(orderId, shopifyId, order.name)
        }

        result.orderId = orderId
        result.summary = {
          created_at: order.created_at,
          email: order.email,
          line_items_count: (order.line_items || []).length,
          total: order.current_total_price,
          tags: order.tags,
        }

        this.logger.log('info', 'Order imported successfully', {
          shopifyId,
          name: order.name,
          orderId
        })

      } catch (err: any) {
        result.status = 'error'
        result.error = err?.message || String(err)
        result.snapshot = {
          created_at: order.created_at,
          email: order.email,
          line_items_count: (order.line_items || []).length,
          total: order.current_total_price,
          tags: order.tags,
        }

        const errorMsg = `Failed to import order ${order.name} (${shopifyId}): ${result.error}`
        this.logger.log('error', errorMsg)
        errors.push(errorMsg)
      }

      results.push(result)

      // Write individual result to file
      await this.logger.writeJson(
        `orders/${runId}-${result.shopifyId}-${result.status}.json`,
        result
      )
    }))

    // Calculate summary
    const successfulImports = results.filter(r => r.status === 'success').length
    const updatedImports = results.filter(r => r.status === 'updated').length
    const failedImports = results.filter(r => r.status === 'error').length
    const skippedOrders = results.filter(r => r.status === 'skipped').length

    const syncResult: SyncResult = {
      runId,
      timestamp: new Date().toISOString(),
      totalOrders: orders.length,
      successfulImports: successfulImports + updatedImports, // Combine new and updated
      failedImports,
      skippedOrders,
      errors
    }

    // Write summary to file
    await this.logger.writeJson(
      `${runId}-sync-summary.json`,
      syncResult
    )

    this.logger.log('info', 'Sync completed', {
      runId,
      totalOrders: orders.length,
      successfulImports: successfulImports + updatedImports,
      updatedImports,
      failedImports,
      skippedOrders
    })

    return syncResult
  }
}
