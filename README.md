## Shopify → Supabase Sync

A structured TypeScript application that imports Shopify orders into the Magento Admin Supabase database. Uses tag-based idempotency and comprehensive logging.

### Project Structure

```
src/
├── types.ts              # TypeScript interfaces for all data structures
├── index.ts              # Main entry point and orchestration
└── services/
    ├── database.ts       # Database operations (Supabase)
    ├── shopify.ts        # Shopify API operations
    ├── mapper.ts         # Data transformation between Shopify and DB
    └── sync.ts           # Main sync orchestration service
```

### Features

- **Type Safety**: Full TypeScript interfaces for all data structures
- **Service Architecture**: Modular services for database, Shopify API, and data mapping
- **Comprehensive Logging**: Structured JSON logs with file output
- **Error Handling**: Retry logic and detailed error reporting
- **Idempotency**: Tag-based workflow prevents duplicate imports
- **Configurable**: Environment-based configuration with sensible defaults

### Setup

1. Copy `.env.example` to `.env` and fill values
2. `npm install`
3. `npm run sync:once` to run once, or `npm run dev` for daemon mode

### Environment Variables

#### Required
- `SHOPIFY_STORE_DOMAIN` - Your store domain (e.g., `your-store.myshopify.com`)
- `SHOPIFY_API_VERSION` - API version (e.g., `2024-07`)
- `SHOPIFY_ADMIN_ACCESS_TOKEN` - Admin API access token
- `SHOPIFY_IMPORT_TAG` - Tag to identify orders for import
- `SHOPIFY_PROCESSED_TAG` - Tag to apply after successful import
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

#### Optional
- `SYNC_SINCE` - ISO datetime to only import orders after this date
- `LOG_LEVEL` - Logging level (`debug`, `info`, `warn`, `error`)
- `LOG_DIR` - Directory for log files (default: `./logs`)
- `SYNC_CONCURRENCY` - Number of concurrent order imports (default: 3)
- `SYNC_RETRIES` - Number of retries for failed operations (default: 2)

### Data Mapping

The sync maps Shopify order data to the following Supabase tables:

- **customers** - Customer information with billing/shipping addresses
- **orders** - Order core data with bill_to_name and ship_to_name
- **order_items** - Line items from the order
- **order_billing_address** - Billing address details
- **order_shipping_address** - Shipping address details

### Logging

All operations are logged with structured JSON output:

- **Console**: Real-time structured logs
- **Files**: Individual order results and sync summaries
- **Location**: `./logs/` directory (configurable)

### Usage

```bash
# Run once
npm run sync:once

# Run as daemon (every 30 minutes)
npm run dev

# Build for production
npm run build
npm start
```


