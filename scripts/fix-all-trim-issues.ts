// Script to fix ALL trim issues in the production import script
import * as fs from "fs";
import * as path from "path";

const filePath = path.join(__dirname, "import-orders-ultra-fast-production.ts");

console.log("🔧 Fixing all trim issues in production script...");

let content = fs.readFileSync(filePath, "utf-8");

// Fix all the trim issues by replacing ?.trim() with proper null checking
const replacements = [
  // Customer data preparation
  { from: 'orderData["Customer Email"].trim()', to: 'String(orderData["Customer Email"] || "").trim()' },
  { from: 'orderData["Billing First Name:"].trim()', to: 'String(orderData["Billing First Name:"] || "").trim()' },
  { from: 'orderData["Billing Last Name"].trim()', to: 'String(orderData["Billing Last Name"] || "").trim()' },
  { from: 'orderData["Billing Street1"]?.trim()', to: 'String(orderData["Billing Street1"] || "").trim()' },
  { from: 'orderData["Billing City"]?.trim()', to: 'String(orderData["Billing City"] || "").trim()' },
  { from: 'orderData["Billing Region"]?.trim()', to: 'String(orderData["Billing Region"] || "").trim()' },
  { from: 'orderData["Billing PostCode"]?.trim()', to: 'String(orderData["Billing PostCode"] || "").trim()' },
  { from: 'orderData["Billing Country"]?.trim()', to: 'String(orderData["Billing Country"] || "").trim()' },
  { from: 'orderData["Shipping First Name:"]?.trim()', to: 'String(orderData["Shipping First Name:"] || "").trim()' },
  { from: 'orderData["Shipping Last Name"]?.trim()', to: 'String(orderData["Shipping Last Name"] || "").trim()' },
  { from: 'orderData["Shipping Street1"]?.trim()', to: 'String(orderData["Shipping Street1"] || "").trim()' },
  { from: 'orderData["Shipping City"]?.trim()', to: 'String(orderData["Shipping City"] || "").trim()' },
  { from: 'orderData["Shipping Region"]?.trim()', to: 'String(orderData["Shipping Region"] || "").trim()' },
  { from: 'orderData["Shipping PostCode"]?.trim()', to: 'String(orderData["Shipping PostCode"] || "").trim()' },
  { from: 'orderData["Shipping Country"]?.trim()', to: 'String(orderData["Shipping Country"] || "").trim()' },
  { from: 'orderData["Customer Email"]?.trim()', to: 'String(orderData["Customer Email"] || "").trim()' },
];

// Apply all replacements
for (const replacement of replacements) {
  const regex = new RegExp(replacement.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, replacement.to);
}

// Write the fixed content back
fs.writeFileSync(filePath, content);

console.log("✅ All trim issues fixed!");
console.log("🚀 You can now run: npm run import-orders-production");
