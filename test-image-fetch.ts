import 'dotenv/config'
import { ShopifyService } from './src/services/shopify'
import { DataMapper } from './src/services/mapper'

// Test script to verify image URL fetching functionality
async function testImageFetching() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN
  const apiVersion = process.env.SHOPIFY_API_VERSION
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN

  if (!storeDomain || !apiVersion || !accessToken) {
    console.error('Missing required environment variables')
    process.exit(1)
  }

  const shopify = new ShopifyService(storeDomain, apiVersion, accessToken)

  // Test with a sample line item (you'll need to replace with actual data)
  const testLineItem = {
    id: 1234567890,
    product_id: 123456789, // Replace with actual product ID from your store
    title: 'Test Product',
    quantity: 1,
    price: '99.99',
    sku: 'TEST-SKU'
  }

  console.log('Testing image URL fetching...')
  console.log('Line item:', testLineItem)

  try {
    const imageUrl = await shopify.getProductImageUrl(testLineItem)
    console.log('Image URL:', imageUrl)
    
    if (imageUrl) {
      console.log('✅ Image URL fetched successfully!')
    } else {
      console.log('ℹ️ No image found for this product')
    }
  } catch (error) {
    console.error('❌ Error fetching image:', error)
  }

  // Test the mapper with image URLs
  console.log('\nTesting DataMapper with image URLs...')
  
  const mockOrder = {
    id: 1,
    name: 'TEST-ORDER',
    line_items: [testLineItem],
    email: 'test@example.com',
    created_at: new Date().toISOString(),
    current_total_price: '99.99',
    tags: 'test'
  }

  const imageUrls = new Map<number, string>()
  if (imageUrl) {
    imageUrls.set(testLineItem.id, imageUrl)
  }

  const items = DataMapper.mapShopifyToOrderItems(mockOrder as any, imageUrls)
  console.log('Mapped order items:', JSON.stringify(items, null, 2))
}

testImageFetching().catch(console.error)
