## Shopify → Supabase Sync

Runs on a schedule to import Shopify orders matching a tag into the Magento Admin Supabase database. Uses `public.shopify_imports` for idempotency.

### Setup


1. Copy `.env.example` to `.env` and fill values.
2. `npm i`
3. `npm run dev` to run once (use `--once` to run a single pass).

### Environment

* `SHOPIFY_STORE_DOMAIN` like `your-store.myshopify.com`
* `SHOPIFY_API_VERSION` e.g. `2024-07`
* `SHOPIFY_ADMIN_ACCESS_TOKEN` Admin API access token
* `SHOPIFY_IMPORT_TAG` tag to import
* `SHOPIFY_PROCESSED_TAG` tag to apply after success
* `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
* `SYNC_SINCE` optional ISO datetime cutoff


