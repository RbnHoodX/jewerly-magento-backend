import { config } from "dotenv";
import { ShopifyEmailService } from "../services/shopifyEmail";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const logger = new Logger("EmailTestFix");

async function testEmailSending() {
  logger.log("info", "🧪 Testing email sending functionality...");

  // Test Gmail configuration
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const fromEmail = process.env.FROM_EMAIL;

  logger.log("info", "📧 Gmail Configuration:", {
    gmailUser: gmailUser ? "✅ Set" : "❌ Missing",
    gmailPassword: gmailPassword ? "✅ Set" : "❌ Missing",
    fromEmail: fromEmail || "❌ Missing",
  });

  if (!gmailUser || !gmailPassword) {
    logger.log("error", "❌ Gmail credentials not configured properly!");
    logger.log("info", "Please ensure GMAIL_USER and GMAIL_APP_PASSWORD are set in .env file");
    return;
  }

  // Test email service
  const emailService = new ShopifyEmailService();

  // Test email data
  const testEmailData = {
    to: "creativesoftware.dev1009@gmail.com", // Test email address
    subject: "🧪 PrimeStyle Email Test - " + new Date().toISOString(),
    body: `
Hello! This is a test email from PrimeStyle automation system.

Test Details:
- Timestamp: ${new Date().toISOString()}
- Service: Gmail SMTP
- App: MagentoStatuses
- From: ${fromEmail}

If you receive this email, the email sending functionality is working correctly!

Best regards,
PrimeStyle Automation System
    `.trim(),
    from: fromEmail,
  };

  try {
    logger.log("info", "📤 Sending test email...", {
      to: testEmailData.to,
      subject: testEmailData.subject,
    });

    const emailId = await emailService.sendEmail(testEmailData);

    logger.log("info", "✅ Email sent successfully!", {
      emailId,
      to: testEmailData.to,
      subject: testEmailData.subject,
    });

    logger.log("info", "🎉 Email sending is working correctly!");
    logger.log("info", "Check your inbox at: " + testEmailData.to);

  } catch (error) {
    logger.log("error", "❌ Failed to send email:", error);

    // Provide specific troubleshooting steps
    if (error.message.includes("Invalid login")) {
      logger.log("error", "🔐 Gmail authentication failed!");
      logger.log("info", "Troubleshooting steps:");
      logger.log("info", "1. Verify the Gmail app password is correct: " + gmailPassword);
      logger.log("info", "2. Ensure 2-factor authentication is enabled on the Gmail account");
      logger.log("info", "3. Generate a new app password if needed");
    } else if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
      logger.log("error", "🌐 Network connection failed!");
      logger.log("info", "Troubleshooting steps:");
      logger.log("info", "1. Check your internet connection");
      logger.log("info", "2. Verify Gmail SMTP settings are correct");
    } else {
      logger.log("error", "❓ Unknown error occurred");
      logger.log("info", "Error details:", error);
    }
  }
}

// Run the test
testEmailSending().catch((error) => {
  logger.log("error", "Test failed:", error);
  process.exit(1);
});
