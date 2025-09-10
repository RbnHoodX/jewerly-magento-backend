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
        // Fetch image URLs for line items
        const imageUrls = new Map<number, string>()
        if (order.line_items && order.line_items.length > 0) {
          this.logger.log('debug', 'Fetching product images', {
            shopifyId,
            lineItemsCount: order.line_items.length
          })
          
          for (const lineItem of order.line_items) {
            try {
              const imageUrl = await this.shopify.getProductImageUrl(lineItem)
              if (imageUrl) {
                imageUrls.set(lineItem.id, imageUrl)
                this.logger.log('debug', 'Found product image', {
                  lineItemId: lineItem.id,
                  productId: lineItem.product_id,
                  imageUrl
                })
              }
            } catch (error) {
              this.logger.log('warn', 'Failed to fetch image for line item', {
                lineItemId: lineItem.id,
                productId: lineItem.product_id,
                error: error instanceof Error ? error.message : String(error)
              })
            }
          }
        }

        // Map Shopify data to our database format
        const customerData = DataMapper.mapShopifyToCustomerData(order)
        const orderData = DataMapper.mapShopifyToOrderData(order)
        const items = DataMapper.mapShopifyToOrderItems(order, imageUrls)
        const billingAddress = DataMapper.mapShopifyToBillingAddress(order)
        const shippingAddress = DataMapper.mapShopifyToShippingAddress(order)

        // Check if order already exists by Shopify ID
        const existingOrderId = await this.db.getOrderIdByShopifyId(shopifyId)
        
        let orderId: string
        
        if (existingOrderId) {
          // Delete all existing data and recreate with fresh Shopify data
          this.logger.log('info', 'Deleting and recreating existing order', {
            shopifyId,
            name: order.name,
            orderId: existingOrderId
          })
          
          // Get existing order data to preserve non-Shopify fields
          const existingOrder = await this.db.getExistingOrderData(existingOrderId)
          
          // Delete all order-related data
          await pRetry(
            () => this.db.deleteOrderData(existingOrderId),
            { retries: this.config.sync.retries }
          )
          
          // Merge Shopify data with existing data, preserving non-Shopify fields
          const mergedOrderData = {
            ...existingOrder, // Preserve all existing data
            ...orderData,     // Override with Shopify data
            id: existingOrderId, // Ensure ID stays the same
            created_at: existingOrder.created_at, // Preserve original creation time
            updated_at: new Date().toISOString() // Update the modified time
          }
          
          // Recreate all data with fresh Shopify data
          await pRetry(
            () => this.db.recreateOrderData(
              existingOrderId,
              customerData,
              mergedOrderData,
              items,
              billingAddress,
              shippingAddress
            ),
            { retries: this.config.sync.retries }
          )

          // Update tracking note instead of creating a new one
          await this.db.updateOrderTrackingNote(existingOrderId, shopifyId, order.name)
          
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
        // Better error handling to show actual error details
        const errorMessage = err?.message || err?.details || err?.hint || String(err)
        result.error = errorMessage
        result.snapshot = {
          created_at: order.created_at,
          email: order.email,
          line_items_count: (order.line_items || []).length,
          total: order.current_total_price,
          tags: order.tags,
        }

        const errorMsg = `Failed to import order ${order.name} (${shopifyId}): ${errorMessage}`
        this.logger.log('error', errorMsg, { 
          fullError: err
        })
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
