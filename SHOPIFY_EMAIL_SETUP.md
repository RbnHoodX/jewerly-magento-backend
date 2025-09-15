# Shopify API Email Setup Guide

## 🛍️ **Using Shopify API for Email Sending**

Perfect choice! Using Shopify's API is ideal since you're already working with Shopify orders. Here's how to set it up:

## **Step 1: Get Shopify API Credentials**

### **Option A: Private App (Recommended)**
1. Go to your Shopify Admin → Settings → Apps and sales channels
2. Click "Develop apps" → "Create an app"
3. Name it "PrimeStyle Automation"
4. Go to "Configuration" tab
5. Enable these permissions:
   - **Orders**: Read and write
   - **Customers**: Read and write
   - **Transactions**: Read and write
6. Click "Save"
7. Go to "API credentials" tab
8. Click "Install app" → "Install"
9. Copy the **Admin API access token**

### **Option B: Custom App (For Production)**
1. Create a custom app in your Shopify Partners dashboard
2. Configure OAuth scopes
3. Get access token through OAuth flow

## **Step 2: Configure Environment Variables**

Add these to your `.env` file:

```bash
# Shopify API Configuration
SHOPIFY_ACCESS_TOKEN=your_admin_api_access_token_here
SHOPIFY_SHOP_DOMAIN=your_shop_domain_without_myshopify_com
```

**Example:**
```bash
SHOPIFY_ACCESS_TOKEN=shpat_1234567890abcdef
SHOPIFY_SHOP_DOMAIN=primestyle-jewelry
```

## **Step 3: Test Email Sending**

```bash
npm run test:email
```

## **How It Works**

The system uses **3 different Shopify API methods**:

### **1. Order Notifications** (Primary Method)
- Uses Shopify's transaction API
- Creates order transactions with custom messages
- Triggers Shopify's built-in email notifications
- **Best for**: Order status updates

### **2. Customer Metafields** (Secondary Method)
- Stores email data in customer metafields
- Can trigger webhooks for email sending
- **Best for**: Custom customer communications

### **3. Webhook Triggers** (Fallback Method)
- Triggers webhooks for email processing
- **Best for**: Custom email templates

## **Email Flow**

```
1. Automation detects status change
2. System calls Shopify API with order/customer ID
3. Shopify processes the notification
4. Email is sent to customer
5. System logs the email in database
```

## **Required Shopify Permissions**

Make sure your app has these permissions:

- ✅ **Orders**: Read and write
- ✅ **Customers**: Read and write  
- ✅ **Transactions**: Read and write
- ✅ **Metafields**: Read and write

## **Testing**

### **Test with Real Order**
```bash
# Update customer email first
npx tsx src/scripts/update-customer-email.ts

# Run automation
npm run automation:run-once

# Check email logs
npx tsx src/scripts/debug-notes-with-service-key.ts
```

### **Test Email Service Directly**
```bash
npm run test:email
```

## **Production Considerations**

### **Rate Limits**
- Shopify API: 40 requests per second
- Our automation: 1 request per minute (very safe)

### **Error Handling**
- Automatic fallback between methods
- Comprehensive logging
- Retry logic built-in

### **Monitoring**
- All emails logged in `email_logs` table
- Success/failure tracking
- Error message logging

## **Troubleshooting**

### **Common Issues**

1. **"Invalid API key"**
   - Check `SHOPIFY_ACCESS_TOKEN` is correct
   - Ensure app is installed and active

2. **"Shop not found"**
   - Check `SHOPIFY_SHOP_DOMAIN` format
   - Should be just the domain name (no .myshopify.com)

3. **"Insufficient permissions"**
   - Check app permissions in Shopify Admin
   - Ensure all required scopes are enabled

### **Debug Commands**

```bash
# Test API connection
npm run test:email

# Check automation logs
npm run automation:run-once

# View email logs
npx tsx src/scripts/debug-notes-with-service-key.ts
```

## **Benefits of Shopify API**

✅ **Native Integration** - Works seamlessly with your existing Shopify setup
✅ **No Additional Costs** - Uses your existing Shopify plan
✅ **Reliable Delivery** - Shopify handles email delivery
✅ **Professional Templates** - Uses Shopify's email templates
✅ **Customer History** - Emails appear in customer order history
✅ **Compliance** - Built-in GDPR and CAN-SPAM compliance

## **Next Steps**

1. **Set up Shopify credentials** in your `.env` file
2. **Test the email service** with `npm run test:email`
3. **Run the automation** with `npm run automation:run-once`
4. **Check your email** at `creativesoftware.dev1009@gmail.com`

You should receive real emails once Shopify is configured! 🚀
