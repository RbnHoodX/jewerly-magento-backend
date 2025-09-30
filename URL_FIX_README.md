# URL and Order ID Fix Script

This script fixes two critical issues in the database:

## Issues Fixed

### 1. Image URL Issue

- **Problem**: Image URLs are imported as just filenames (e.g., `100061467_17585561000.png`)
- **Solution**: Adds proper base URL `https://old-admin.primestyle.com/cron/custom-product/` to incomplete URLs
- **Affects**: `order_3d_related` table

### 2. Order ID Display Issue

- **Problem**: Frontend shows UUID slices instead of proper order numbers
- **Solution**: Ensures all orders have `shopify_order_number` field populated
- **Affects**: `orders` table

## Usage

```bash
# Run the fix script
node fix-url-issues.js
```

## What the Scripts Do

1. **fix-order-items-urls.js**: Updates all image URLs in `order_items` table that don't start with "http" to include the proper base URL
2. **fix-url-issues.js**:
   - Updates all image URLs in `order_3d_related` table that don't start with "http" to include the proper base URL
   - Adds `shopify_order_number` to orders that don't have it, using a generated number based on the UUID

## Safety

- The script only updates records that need fixing
- It doesn't delete or modify existing data unnecessarily
- It preserves existing complete URLs
- It generates order numbers for missing ones without affecting existing ones

## Frontend Changes

The frontend has been updated to:

- Prioritize `shopify_order_number` over UUID slices
- Display proper order numbers consistently
- Handle cases where `shopify_order_number` might be missing

## Import Script Updates

All import scripts have been updated to:

- Set `shopify_order_number` during import
- Add proper base URLs to image paths during import
- Handle both complete and incomplete URLs correctly
