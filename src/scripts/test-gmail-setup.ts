import { config } from "dotenv";
config();

import { ShopifyEmailService } from "../services/shopifyEmail";
import { Logger } from "../utils/logger";

const logger = new Logger("TestGmailSetup");

async function testGmailSetup() {
  try {
    logger.info("Testing Gmail SMTP setup...");

    // Check if Gmail is configured
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;

    if (!gmailUser || !gmailPassword) {
      logger.error("Gmail credentials not found in environment variables");
      logger.info("To enable Gmail SMTP, add to your .env file:");
      logger.info("GMAIL_USER=your_email@gmail.com");
      logger.info("GMAIL_APP_PASSWORD=your_16_character_app_password");
      logger.info("");
      logger.info("To get Gmail App Password:");
      logger.info("1. Enable 2-factor authentication on Gmail");
      logger.info("2. Go to Google Account → Security");
      logger.info("3. Generate 'App Password' for this application");
      return;
    }

    logger.info("Gmail credentials found, testing email sending...");

    const emailService = new ShopifyEmailService();

    const emailData = {
      to: "creativesoftware.dev1009@gmail.com",
      subject: "Test Email from PrimeStyle Automation System (Gmail)",
      body: `Hello!

This is a test email from the PrimeStyle automation system using Gmail SMTP.

Order Details:
- Order Number: 120307
- Status: Casting Order
- Customer: Jenny Adajar

This email was sent using Gmail SMTP integration.

Best regards,
PrimeStyle Automation System`,
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

testGmailSetup();
