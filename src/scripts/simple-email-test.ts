import { config } from "dotenv";
import nodemailer from "nodemailer";

// Load environment variables
config();

async function testGmailDirect() {
  console.log("🧪 Testing Gmail SMTP directly...");

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const fromEmail = process.env.FROM_EMAIL;

  console.log("📧 Configuration:", {
    gmailUser: gmailUser ? "✅ Set" : "❌ Missing",
    gmailPassword: gmailPassword ? "✅ Set" : "❌ Missing",
    fromEmail: fromEmail || "❌ Missing",
  });

  if (!gmailUser || !gmailPassword) {
    console.error("❌ Gmail credentials not configured!");
    return;
  }

  try {
    console.log("🔧 Creating transporter...");

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    console.log("🔍 Verifying connection...");
    await transporter.verify();
    console.log("✅ Connection verified!");

    console.log("📤 Sending test email...");

    const info = await transporter.sendMail({
      from: `"PrimeStyle Automation" <${fromEmail}>`,
      to: "creativesoftware.dev1009@gmail.com",
      subject: "🧪 Direct Gmail Test - " + new Date().toISOString(),
      text: "This is a direct test email from PrimeStyle automation system.",
      html: "<p>This is a direct test email from PrimeStyle automation system.</p>",
    });

    console.log("✅ Email sent successfully!");
    console.log("📧 Message ID:", info.messageId);
    console.log("📧 Response:", info.response);
  } catch (error) {
    console.error("❌ Error occurred:");
    console.error("Type:", typeof error);
    console.error("Message:", error instanceof Error ? error.message : error);
    console.error("Stack:", error instanceof Error ? error.stack : undefined);
    console.error("Full error:", error);
  }
}

testGmailDirect();
