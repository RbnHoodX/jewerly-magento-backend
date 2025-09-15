import { config } from "dotenv";
config();

import { ShopifyEmailService } from "../services/shopifyEmail";
import { Logger } from "../utils/logger";

const logger = new Logger("TestRealEmail");

async function testRealEmail() {
  try {
    logger.info("Testing real email sending...");

    // Check if SendGrid is configured (preferred for real emails)
    const sendGridKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.FROM_EMAIL || "noreply@primestyle.com";

    if (sendGridKey) {
      logger.info("SendGrid API key found, testing real email sending...");
    } else {
      logger.warn("SendGrid not configured, will use mock email sending");
      logger.info("To enable real email sending, add to your .env file:");
      logger.info("SENDGRID_API_KEY=your_sendgrid_api_key");
      logger.info("FROM_EMAIL=noreply@primestyle.com");
    }

    const emailService = new ShopifyEmailService();

    const emailData = {
      to: "creativesoftware.dev1009@gmail.com",
      subject: "Test Email from PrimeStyle Automation System",
      body: `Hello!

This is a test email from the PrimeStyle automation system.

Order Details:
- Order Number: 120307
- Status: Casting Order
- Customer: Jenny Adajar

This email was sent using Shopify API integration.

Best regards,
PrimeStyle Automation System`,
      orderId: "test_order_123", // Test order ID
      customerId: "test_customer_456", // Test customer ID
    };

    const emailId = await emailService.sendEmail(emailData);

    logger.info("Email sent successfully!", {
      emailId,
      to: emailData.to,
      subject: emailData.subject,
    });
  } catch (error) {
    logger.error("Failed to send test email:", error);
  }
}

testRealEmail();
