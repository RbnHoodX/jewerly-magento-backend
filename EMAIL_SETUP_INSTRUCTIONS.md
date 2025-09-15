# Email Setup Instructions

## 🚀 **Enable Real Email Sending**

To send real emails instead of mock emails, you need to configure an email service. Here are your options:

## **Option 1: SendGrid (Recommended)**

### **Step 1: Get SendGrid API Key**
1. Go to [SendGrid.com](https://sendgrid.com)
2. Sign up for a free account (100 emails/day free)
3. Go to Settings → API Keys
4. Create a new API Key with "Full Access" permissions
5. Copy the API key

### **Step 2: Configure Environment Variables**
Add these to your `.env` file:

```bash
# SendGrid Configuration
SENDGRID_API_KEY=your_sendgrid_api_key_here
FROM_EMAIL=noreply@primestyle.com
```

### **Step 3: Test Email Sending**
```bash
npm run test:email
```

## **Option 2: Mailgun**

### **Step 1: Get Mailgun Credentials**
1. Go to [Mailgun.com](https://mailgun.com)
2. Sign up for a free account (10,000 emails/month free)
3. Get your API key and domain

### **Step 2: Configure Environment Variables**
```bash
# Mailgun Configuration
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
FROM_EMAIL=noreply@primestyle.com
```

## **Option 3: Gmail SMTP**

### **Step 1: Enable App Passwords**
1. Enable 2-factor authentication on your Gmail account
2. Go to Google Account settings
3. Generate an "App Password" for this application

### **Step 2: Configure Environment Variables**
```bash
# Gmail SMTP Configuration
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_app_password
FROM_EMAIL=your_email@gmail.com
```

## **Current Status**

Right now, the system is using **mock emails** because no email service is configured. This is why you didn't receive the email at `creativesoftware.dev1009@gmail.com`.

## **Quick Test**

To test if SendGrid is working:

1. **Add SendGrid API key to `.env`**:
   ```bash
   SENDGRID_API_KEY=SG.your_key_here
   FROM_EMAIL=noreply@primestyle.com
   ```

2. **Run the test script**:
   ```bash
   npx tsx src/scripts/test-real-email.ts
   ```

3. **Check your email** at `creativesoftware.dev1009@gmail.com`

## **Production Setup**

For production, you should:

1. **Use a professional email service** (SendGrid, Mailgun, etc.)
2. **Set up proper domain authentication**
3. **Configure email templates**
4. **Set up email monitoring and analytics**

## **Free Tier Limits**

- **SendGrid**: 100 emails/day free
- **Mailgun**: 10,000 emails/month free
- **Gmail SMTP**: 500 emails/day free

Choose the service that best fits your needs!
