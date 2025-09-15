#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔧 Setting up email configuration...\n");

// Gmail credentials provided by user
const gmailUser = "sales@primestyle.com";
const gmailPassword = "nlptxxyrdjgariwx";
const fromEmail = "sales@primestyle.com";

// Create .env file content
const envContent = `# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Shopify Configuration
SHOPIFY_ACCESS_TOKEN=your_shopify_access_token_here
SHOPIFY_SHOP_DOMAIN=your_shopify_shop_domain_here

# Email Configuration - Gmail SMTP
GMAIL_USER=${gmailUser}
GMAIL_APP_PASSWORD=${gmailPassword}
FROM_EMAIL=${fromEmail}

# SendGrid Configuration (optional - leave empty to use Gmail)
SENDGRID_API_KEY=

# Google API Configuration (for Google Sheets)
GOOGLE_API_KEY=your_google_api_key_here

# Automation Configuration
AUTOMATION_ENABLED=true
AUTOMATION_INTERVAL_MINUTES=60
`;

// Write .env file
const envPath = path.join(__dirname, ".env");
fs.writeFileSync(envPath, envContent);

console.log("✅ .env file created successfully!");
console.log("📧 Gmail SMTP configured with:");
console.log(`   User: ${gmailUser}`);
console.log(`   App Password: ${gmailPassword}`);
console.log(`   From Email: ${fromEmail}`);
console.log(
  "\n⚠️  Please update the other environment variables in .env file:"
);
console.log("   - SUPABASE_URL");
console.log("   - SUPABASE_ANON_KEY");
console.log("   - SUPABASE_SERVICE_ROLE_KEY");
console.log("   - SHOPIFY_ACCESS_TOKEN");
console.log("   - SHOPIFY_SHOP_DOMAIN");
console.log('\n🚀 Run "npm run test:gmail" to test email sending!');
