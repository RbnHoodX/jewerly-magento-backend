import nodemailer from "nodemailer";
import { config } from "dotenv";

// Load environment variables
config();

console.log("🧪 Testing nodemailer...");

const gmailUser = process.env.GMAIL_USER;
const gmailPassword = process.env.GMAIL_APP_PASSWORD;

console.log("Gmail User:", gmailUser);
console.log("Gmail Password:", gmailPassword ? "Set" : "Not set");

if (!gmailUser || !gmailPassword) {
  console.error("❌ Missing credentials");
  process.exit(1);
}

try {
  console.log("Creating transporter...");

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmailUser,
      pass: gmailPassword,
    },
  });

  console.log("Verifying connection...");

  transporter.verify((error, success) => {
    if (error) {
      console.error("❌ Connection failed:", error);
    } else {
      console.log("✅ Connection verified!");

      // Send test email
      console.log("Sending test email...");

      transporter.sendMail(
        {
          from: `"PrimeStyle Test" <${gmailUser}>`,
          to: "creativesoftware.dev1009@gmail.com",
          subject: "Test Email from PrimeStyle",
          text: "This is a test email from PrimeStyle automation system.",
        },
        (error, info) => {
          if (error) {
            console.error("❌ Send failed:", error);
          } else {
            console.log("✅ Email sent successfully!");
            console.log("Message ID:", info.messageId);
          }
        }
      );
    }
  });
} catch (error) {
  console.error("❌ Error:", error);
}
