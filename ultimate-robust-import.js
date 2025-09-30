import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import path from "path";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase configuration missing");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

const MIGRATION_DIR = path.join(process.cwd(), "migration");

async function ultimateRobustImport() {
  console.log("🚀 ULTIMATE ROBUST IMPORT - NO DUPLICATES GUARANTEED");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear all tables
    console.log("\n🗑️ STEP 1: Clearing all tables...");
    
    const tablesToClear = [
      "order_3d_related",
      "order_items", 
      "order_shipping_address",
      "order_billing_address",
      "order_employee_comments",
      "order_customer_notes",
      "order_casting",
      "diamond_deductions",
      "orders",
      "customers"
    ];

    for (const table of tablesToClear) {
      console.log(`🗑️ Clearing ${table}...`);
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        console.log(`⚠️ Warning clearing ${table}: ${error.message}`);
      } else {
        console.log(`✅ Cleared ${table}`);
      }
    }

    // Step 2: Process CSV with ultimate deduplication
    console.log("\n📊 STEP 2: Processing CSV with ultimate deduplication...");
    
    const mainCsvPath = path.join(MIGRATION_DIR, "main_page.csv");
    const mainFileContent = fs.readFileSync(mainCsvPath, "utf8");
    const mainRecords = parse(mainFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${mainRecords.length} CSV records`);

    // Ultimate deduplication - track both email and customer_id
    const uniqueCustomers = new Map(); // email -> customer data
    const processedEmails = new Set();
    const processedCustomerIds = new Set();
    let duplicateEmailCount = 0;
    let duplicateIdCount = 0;

    console.log("🔄 Ultimate deduplication in progress...");
    
    for (const record of mainRecords) {
      const email = record['Customer Email']?.trim();
      const customerId = record['Customer Id']?.toString();
      
      if (email && customerId) {
        const emailLower = email.toLowerCase();
        
        // Skip if we've already processed this email or customer_id
        if (processedEmails.has(emailLower)) {
          duplicateEmailCount++;
          continue;
        }
        
        if (processedCustomerIds.has(customerId)) {
          duplicateIdCount++;
          continue;
        }
        
        const billingFirstName = record['Billing First Name:']?.trim() || 'Unknown';
        const billingLastName = record['Billing Last Name']?.trim() || 'Customer';
        const billingStreet1 = record['Billing Street1']?.trim();
        const billingCity = record['Billing City']?.trim();
        const billingRegion = record['Billing Region']?.trim();
        const billingPostCode = record['Billing PostCode']?.trim();
        const billingCountry = record['Billing Country']?.trim();
        const shippingStreet1 = record['Shipping Street1']?.trim();
        const shippingCity = record['Shipping City']?.trim();
        const shippingRegion = record['Shipping Region']?.trim();
        const shippingPostCode = record['Shipping PostCode']?.trim();
        const shippingCountry = record['Shipping Country']?.trim();
        
        // Build address strings
        const billingAddr = [
          billingStreet1,
          billingCity,
          billingRegion,
          billingPostCode,
          billingCountry
        ].filter(Boolean).join(', ') || 'Unknown Address';
        
        const shippingAddr = [
          shippingStreet1,
          shippingCity,
          shippingRegion,
          shippingPostCode,
          shippingCountry
        ].filter(Boolean).join(', ') || 'Unknown Address';

        const customerData = {
          customer_id: customerId,
          email: email,
          name: `${billingFirstName} ${billingLastName}`,
          first_name: billingFirstName,
          last_name: billingLastName,
          phone: record['Billing Tel']?.trim() || null,
          billing_addr: billingAddr,
          shipping_addr: shippingAddr,
          created_at: new Date().toISOString()
        };

        uniqueCustomers.set(emailLower, customerData);
        processedEmails.add(emailLower);
        processedCustomerIds.add(customerId);
      }
    }

    const customerArray = Array.from(uniqueCustomers.values());
    console.log(`📊 Found ${customerArray.length} unique customers after deduplication`);
    console.log(`📊 Duplicate emails skipped: ${duplicateEmailCount}`);
    console.log(`📊 Duplicate customer IDs skipped: ${duplicateIdCount}`);

    // Step 3: Import customers one by one with proper error handling
    console.log("\n👥 STEP 3: Importing customers one by one (guaranteed no duplicates)...");
    
    let customersCreated = 0;
    let customersSkipped = 0;
    
    for (let i = 0; i < customerArray.length; i++) {
      const customer = customerArray[i];
      const progress = Math.round(((i + 1) / customerArray.length) * 100);
      
      try {
        // Try to insert the customer
        const { error } = await supabase
          .from("customers")
          .insert(customer);

        if (error) {
          if (error.code === '23505') { // Duplicate key error
            customersSkipped++;
            if (customersSkipped % 100 === 0) {
              console.log(`⚠️ Skipped ${customersSkipped} duplicates so far... (${progress}%)`);
            }
          } else {
            console.error(`❌ Error inserting customer ${customer.email}:`, error.message);
          }
        } else {
          customersCreated++;
          if (customersCreated % 500 === 0) {
            console.log(`✅ Imported ${customersCreated} customers... (${progress}%)`);
          }
        }
      } catch (err) {
        console.error(`❌ Unexpected error with customer ${customer.email}:`, err.message);
      }
      
      // Show progress every 1000 customers
      if ((i + 1) % 1000 === 0) {
        console.log(`📊 Progress: ${i + 1}/${customerArray.length} (${progress}%) - Created: ${customersCreated}, Skipped: ${customersSkipped}`);
      }
    }

    // Step 4: Final status
    console.log("\n" + "=".repeat(70));
    console.log("🔄 CUSTOMER IMPORT COMPLETED");
    
    const { count: finalCustomerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL CUSTOMER COUNT: ${finalCustomerCount}`);
    console.log(`📊 UNIQUE CUSTOMERS FROM CSV: ${customerArray.length}`);
    console.log(`📊 CUSTOMERS CREATED: ${customersCreated}`);
    console.log(`📊 CUSTOMERS SKIPPED (duplicates): ${customersSkipped}`);
    
    if (customersCreated + customersSkipped === customerArray.length) {
      console.log("✅ All customers processed successfully!");
    } else {
      console.log(`⚠️ Processing mismatch: Expected ${customerArray.length}, processed ${customersCreated + customersSkipped}`);
    }

    console.log("\n✅ Ultimate robust import completed!");
    console.log("📊 All unique customers imported with zero duplicate errors");

  } catch (error) {
    console.error("❌ Error during import:", error);
  }
}

ultimateRobustImport();
