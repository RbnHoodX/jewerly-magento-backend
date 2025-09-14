# Environment Setup - PrimeStyle Automation

## Required Environment Variables

Create a `.env` file in the `shopify-database-sync` directory with the following variables:

```bash
# Supabase Configuration (Required)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Shopify Configuration (Optional - for email sending)
SHOPIFY_API_KEY=your_shopify_api_key
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_SHOP_DOMAIN=your_shop_domain
```

## Example .env File

```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
```

## How to Get Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the Project URL and anon/public key

## How to Get Shopify Credentials

1. Go to your Shopify admin panel
2. Navigate to Apps > App and sales channel settings
3. Create a private app or use existing API credentials
4. Copy the API key and secret

## Testing the Setup

Once you've created the `.env` file, test the automation:

```bash
# Test migrations
npm run test:migrations

# Test automation (run once)
npm run automation:run-once

# Start automation service
npm run automation:start
```

## Troubleshooting

If you get "environment variables are required" error:

1. Make sure `.env` file exists in the correct directory
2. Check that variable names match exactly (case-sensitive)
3. Ensure there are no spaces around the `=` sign
4. Restart your terminal after creating the `.env` file
