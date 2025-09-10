# Image URL Sync for Shopify Orders

This document explains how image URLs are now fetched and synced from Shopify to Supabase during the order import process.

## Overview

When syncing orders from Shopify to Supabase, the system now automatically fetches product images for each line item and stores the image URL in the `order_items.image` field.

## How It Works

1. **Product Image Fetching**: For each line item in a Shopify order, the system:
   - Checks if the line item has a `product_id`
   - Fetches the product details from Shopify's API
   - Extracts the first image URL from the product's images array
   - Maps the image URL to the line item ID

2. **Data Mapping**: The `DataMapper.mapShopifyToOrderItems()` method now accepts an optional `imageUrls` parameter that maps line item IDs to their corresponding image URLs.

3. **Database Storage**: The image URL is stored in the `order_items.image` field in Supabase.

## Implementation Details

### New Types
- `ShopifyProduct`: Represents a Shopify product with images array
- Updated `OrderItemInsertData` to include optional `image` field

### New Methods
- `ShopifyService.fetchProduct(productId)`: Fetches product details from Shopify
- `ShopifyService.getProductImageUrl(lineItem)`: Gets image URL for a line item
- Updated `DataMapper.mapShopifyToOrderItems()` to accept image URLs

### Sync Process
The sync process now:
1. Fetches image URLs for all line items before mapping
2. Passes the image URLs to the data mapper
3. Stores the image URLs in the database

## Error Handling

- If a product image cannot be fetched, the system logs a warning and continues
- Line items without images will have `null` in the image field
- Failed image fetches don't prevent order import

## Testing

Run the test script to verify image fetching works:

```bash
# Set your environment variables first
export SHOPIFY_STORE_DOMAIN="your-store.myshopify.com"
export SHOPIFY_API_VERSION="2023-10"
export SHOPIFY_ADMIN_ACCESS_TOKEN="your-access-token"

# Run the test
npx tsx test-image-fetch.ts
```

## Database Schema

Ensure your Supabase `order_items` table has an `image` column:

```sql
ALTER TABLE order_items ADD COLUMN image TEXT;
```

## Performance Considerations

- Image fetching adds API calls to Shopify (one per unique product)
- The system processes images in sequence to avoid rate limiting
- Consider implementing caching for frequently accessed products
