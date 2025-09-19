import { config } from "dotenv";
import { ShopifyEmailService } from "../services/shopifyEmail";

// Load environment variables
config();

async function testEmailConfig() {
  console.log("🔍 Testing email configuration...\n");

  // Log environment variables (without showing sensitive data)
  console.log("📧 Email Environment Variables:");
  console.log(`   GMAIL_USER: ${process.env.GMAIL_USER ? "SET" : "NOT SET"}`);
  console.log(
    `   GMAIL_APP_PASSWORD: ${
      process.env.GMAIL_APP_PASSWORD ? "SET" : "NOT SET"
    }`
  );
  console.log(
    `   SENDGRID_API_KEY: ${process.env.SENDGRID_API_KEY ? "SET" : "NOT SET"}`
  );
  console.log(
    `   SHOPIFY_ACCESS_TOKEN: ${
      process.env.SHOPIFY_ACCESS_TOKEN ? "SET" : "NOT SET"
    }`
  );
  console.log(
    `   SHOPIFY_SHOP_DOMAIN: ${
      process.env.SHOPIFY_SHOP_DOMAIN ? "SET" : "NOT SET"
    }`
  );
  console.log(`   FROM_EMAIL: ${process.env.FROM_EMAIL || "NOT SET"}\n`);

  try {
    const emailService = new ShopifyEmailService();

    console.log("📧 Testing email service...");
    const testEmail = {
      to: "test@example.com",
      subject: "Test Email from PrimeStyle Automation",
      body: "This is a test email to verify the email service configuration.",
      orderId: "test-order-123",
      type: "customer",
    };

    console.log("🚀 Attempting to send test email...");
    const emailId = await emailService.sendEmail(testEmail);
    console.log(`✅ Email sent successfully! Email ID: ${emailId}`);
  } catch (error) {
    console.error("❌ Email test failed:", error);

    // Try to provide helpful debugging information
    if (error instanceof Error) {
      if (error.message.includes("Gmail SMTP connection failed")) {
        console.log("\n💡 Gmail SMTP Issues:");
        console.log(
          "   - Check if GMAIL_USER and GMAIL_APP_PASSWORD are correct"
        );
        console.log(
          "   - Ensure 2-factor authentication is enabled and app password is used"
        );
        console.log("   - Check if Gmail SMTP is accessible from Railway");
      } else if (error.message.includes("SendGrid")) {
        console.log("\n💡 SendGrid Issues:");
        console.log("   - Check if SENDGRID_API_KEY is valid");
        console.log("   - Verify SendGrid account is active");
      } else if (error.message.includes("Shopify")) {
        console.log("\n💡 Shopify API Issues:");
        console.log(
          "   - Check if SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN are correct"
        );
        console.log("   - Verify Shopify API permissions");
      }
    }
  }
}

testEmailConfig().catch(console.error);
