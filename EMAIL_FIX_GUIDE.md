# 🔧 Email Sending Fix Guide

## Problem
Email sending is not working in the PrimeStyle automation system.

## Solution
Configure Gmail SMTP with the provided credentials to enable real email sending.

## 📧 Gmail Credentials Provided
- **Email**: support@primestyle.com
- **App Password**: nlptxxyrdjgariwx
- **App Name**: MagentoStatuses

## 🚀 Quick Setup Steps

### 1. Set Up Environment Variables
Run the setup script to create the .env file:

```bash
cd shopify-database-sync
node setup-email-config.js
```

### 2. Update .env File
Edit the `.env` file and add your Supabase and Shopify credentials:

```env
# Supabase Configuration
SUPABASE_URL=your_actual_supabase_url
SUPABASE_ANON_KEY=your_actual_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_supabase_service_role_key

# Shopify Configuration
SHOPIFY_ACCESS_TOKEN=your_actual_shopify_access_token
SHOPIFY_SHOP_DOMAIN=your_actual_shopify_shop_domain

# Email Configuration - Gmail SMTP (Already configured)
GMAIL_USER=support@primestyle.com
GMAIL_APP_PASSWORD=nlptxxyrdjgariwx
FROM_EMAIL=support@primestyle.com
```

### 3. Test Email Sending
Run the email test to verify everything is working:

```bash
npm run test:email-fix
```

### 4. Test Automation
Run the automation to test real email sending:

```bash
npm run automation:run-once
```

## 🔍 Troubleshooting

### If Gmail Authentication Fails:
1. **Verify App Password**: Ensure the app password `nlptxxyrdjgariwx` is correct
2. **Check 2FA**: Make sure 2-factor authentication is enabled on support@primestyle.com
3. **Generate New Password**: If needed, generate a new app password in Gmail settings

### If Connection Fails:
1. **Check Internet**: Ensure stable internet connection
2. **Firewall**: Check if corporate firewall blocks SMTP ports
3. **Gmail Settings**: Verify Gmail allows "less secure apps" or use app passwords

### If Emails Don't Arrive:
1. **Check Spam**: Look in spam/junk folder
2. **Email Address**: Verify the recipient email address is correct
3. **Gmail Limits**: Check if Gmail has daily sending limits

## 📋 What Was Fixed

### 1. Gmail SMTP Configuration
- ✅ Added explicit SMTP settings (host: smtp.gmail.com, port: 587)
- ✅ Added connection verification before sending
- ✅ Added proper error handling and logging
- ✅ Added TLS configuration for security

### 2. Email Service Priority
- ✅ Gmail SMTP is now the primary email service
- ✅ SendGrid as fallback (if configured)
- ✅ Shopify API as secondary fallback
- ✅ Mock email as final fallback

### 3. Enhanced Logging
- ✅ Detailed connection verification logs
- ✅ Email sending success/failure logs
- ✅ Troubleshooting information in error messages

## 🎯 Expected Results

After following these steps:
- ✅ Emails will be sent via Gmail SMTP
- ✅ Real emails will be delivered to customers
- ✅ Automation system will work with real email notifications
- ✅ Detailed logs will help troubleshoot any issues

## 📞 Support

If you continue to have issues:
1. Check the console logs for specific error messages
2. Verify all environment variables are set correctly
3. Test with a simple email first using `npm run test:email-fix`
4. Check Gmail account settings and app password validity
