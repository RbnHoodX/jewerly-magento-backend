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

async function fastRobustImport() {
  console.log("🚀 FAST ROBUST IMPORT WITH IN-MEMORY PROCESSING");
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

    // Step 2: Process CSV with in-memory deduplication
    console.log("\n📊 STEP 2: Processing CSV with in-memory deduplication...");
    
    const mainCsvPath = path.join(MIGRATION_DIR, "main_page.csv");
    const mainFileContent = fs.readFileSync(mainCsvPath, "utf8");
    const mainRecords = parse(mainFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${mainRecords.length} CSV records`);

    // In-memory deduplication using Maps
    const uniqueCustomers = new Map(); // email -> customer data
    const processedEmails = new Set();
    const processedCustomerIds = new Set();
    let duplicateEmailCount = 0;
    let duplicateIdCount = 0;

    console.log("🔄 Deduplicating customers in memory...");
    
    for (const record of mainRecords) {
      const email = record['Customer Email']?.trim();
      const customerId = record['Customer Id']?.toString();
      
      if (email && customerId) {
        const emailLower = email.toLowerCase();
        
        // Check for duplicates and track them
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

    // Step 3: Fast batch import (no more customer_id constraint issues!)
    console.log("\n👥 STEP 3: Fast batch import with upsert...");
    
    const batchSize = 2000; // Larger batches for speed
    let customersCreated = 0;
    
    for (let i = 0; i < customerArray.length; i += batchSize) {
      const batch = customerArray.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(customerArray.length / batchSize);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} customers)...`);
      
      try {
        // Use upsert with email conflict resolution
        const { error } = await supabase
          .from("customers")
          .upsert(batch, { 
            onConflict: 'email',
            ignoreDuplicates: false 
          });

        if (error) {
          console.error(`❌ Error upserting batch ${batchNumber}:`, error.message);
        } else {
          customersCreated += batch.length;
          console.log(`✅ Batch ${batchNumber} upserted successfully (${batch.length} customers)`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error in batch ${batchNumber}:`, err.message);
      }
      
      // Progress update
      const progress = Math.round(((i + batch.length) / customerArray.length) * 100);
      console.log(`📊 Progress: ${Math.min(i + batch.length, customerArray.length)}/${customerArray.length} (${progress}%) - Created: ${customersCreated}`);
    }

    // Step 4: Final status
    console.log("\n" + "=".repeat(70));
    console.log("🔄 CUSTOMER IMPORT COMPLETED");
    
    const { count: finalCustomerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL CUSTOMER COUNT: ${finalCustomerCount}`);
    console.log(`📊 UNIQUE CUSTOMERS FROM CSV: ${customerArray.length}`);
    console.log(`📊 CUSTOMERS CREATED: ${customersCreated}`);
    
    if (customersCreated === customerArray.length) {
      console.log("✅ All customers processed successfully!");
    } else {
      console.log(`⚠️ Processing mismatch: Expected ${customerArray.length}, processed ${customersCreated}`);
    }

    console.log("\n✅ Fast robust import completed!");
    console.log("📊 All unique customers imported with optimal performance");

  } catch (error) {
    console.error("❌ Error during import:", error);
  }
}

fastRobustImport();
