// Test script to check cleaned data
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const migrationDir = path.join(__dirname, "migration/cleaned");
const filePath = path.join(migrationDir, "main_page.csv");

console.log("🔍 Testing cleaned data...");
console.log("📁 Reading from:", filePath);

if (!fs.existsSync(filePath)) {
  console.log("❌ File not found:", filePath);
  process.exit(1);
}

const csvContent = fs.readFileSync(filePath, "utf-8");
const ordersData = parse(csvContent, {
  columns: true,
  skip_empty_lines: true,
  quote: '"',
  escape: '"',
  delimiter: ",",
  relax_column_count: true,
  trim: true,
  cast: true,
  skip_records_with_error: true,
});

console.log(`📊 Found ${ordersData.length} orders in cleaned data`);

// Check first few orders
for (let i = 0; i < Math.min(5, ordersData.length); i++) {
  const order = ordersData[i];
  console.log(`\n📋 Order ${i + 1}:`);
  console.log(`   Order #: ${order["Order #"]}`);
  console.log(`   Email: ${order["Customer Email"]}`);
  console.log(`   Billing First Name: ${order["Billing First Name:"]}`);
  console.log(`   Billing Last Name: ${order["Billing Last Name"]}`);
  console.log(`   Order Date: ${order["Order Date"]}`);
  console.log(`   Billing Tel: ${order["Billing Tel"]}`);
}

// Check for empty dates
const emptyDates = ordersData.filter(order => !order["Order Date"] || order["Order Date"].trim() === "");
console.log(`\n📅 Orders with empty dates: ${emptyDates.length}`);

// Check for empty phone numbers
const emptyPhones = ordersData.filter(order => !order["Billing Tel"] || order["Billing Tel"].trim() === "");
console.log(`📞 Orders with empty phones: ${emptyPhones.length}`);

// Check for missing names
const missingNames = ordersData.filter(order => 
  !order["Billing First Name:"] || order["Billing First Name:"].trim() === "" ||
  !order["Billing Last Name"] || order["Billing Last Name"].trim() === ""
);
console.log(`👤 Orders with missing names: ${missingNames.length}`);

console.log("\n✅ Data analysis complete!");
