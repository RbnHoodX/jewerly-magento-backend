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

async function importCustomerNotes() {
  console.log("📝 IMPORTING CUSTOMER NOTES FROM CSV");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear existing customer notes
    console.log("\n🗑️ STEP 1: Clearing existing customer notes...");
    
    const { error: clearError } = await supabase
      .from("order_customer_notes")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (clearError) {
      console.log(`⚠️ Warning clearing order_customer_notes: ${clearError.message}`);
    } else {
      console.log(`✅ Cleared order_customer_notes table`);
    }

    // Step 2: Get all orders for mapping
    console.log("\n📦 STEP 2: Getting all orders for customer notes mapping...");
    
    const orderLookup = new Map();
    let allOrders = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error("❌ Error fetching orders:", error.message);
        break;
      }
      
      if (orders && orders.length > 0) {
        allOrders = allOrders.concat(orders);
        page++;
        console.log(`📊 Fetched ${orders.length} orders (page ${page})...`);
      } else {
        hasMore = false;
      }
    }
    
    // Build order lookup map
    allOrders.forEach(order => {
      if (order.order_id) {
        orderLookup.set(order.order_id.toString(), order.id);
      }
    });

    console.log(`📊 Found ${allOrders.length} total orders for mapping`);

    // Step 3: Process CSV file
    console.log("\n📊 STEP 3: Processing Customer Notes CSV...");
    
    const csvPath = path.join(MIGRATION_DIR, "Customer Notes.csv");
    const fileContent = fs.readFileSync(csvPath, "utf8");
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${records.length} customer note records`);

    // Debug: Show sample order numbers and field structure
    console.log("🔍 Debug: Sample records from CSV:");
    for (let i = 0; i < Math.min(3, records.length); i++) {
      console.log(`  - Record ${i + 1}:`, {
        'Order #': records[i]['Order #'],
        'Date Added': records[i]['Date Added'],
        'Order Status': records[i]['Order Status'],
        'Employee': records[i]['Employee'],
        'Comment': records[i]['Comment']?.substring(0, 50) + '...'
      });
    }

    // Step 4: Extract customer notes data
    console.log("\n📝 STEP 4: Extracting customer notes data...");
    
    const customerNotesData = [];
    let notesProcessed = 0;
    let ordersNotFound = 0;
    
    for (const record of records) {
      const orderNumber = record['Order #']?.toString();
      
      // Skip records with invalid order numbers
      if (!orderNumber || 
          orderNumber === 'System' || 
          orderNumber === 'undefined' || 
          orderNumber === 'null' || 
          orderNumber === '0' ||
          orderNumber.toLowerCase().includes('system') ||
          isNaN(parseInt(orderNumber))) {
        ordersNotFound++;
        if (ordersNotFound <= 5) {
          console.log(`⚠️ Skipping invalid order number: ${orderNumber}`);
        }
        continue;
      }
      
      if (orderLookup.has(orderNumber)) {
        const orderId = orderLookup.get(orderNumber);
        
        // Validate that orderId is a valid UUID
        if (!orderId || typeof orderId !== 'string' || orderId.length < 10) {
          ordersNotFound++;
          if (ordersNotFound <= 5) {
            console.log(`⚠️ Invalid order ID for order ${orderNumber}: ${orderId}`);
          }
          continue;
        }
        
        // Parse date from DD/MM/YYYY format to ISO
        let dateAdded = new Date().toISOString();
        if (record['Date Added']) {
          const dateStr = record['Date Added'].toString().trim();
          if (dateStr.includes('/')) {
            // Handle DD/MM/YYYY format
            const [day, month, year] = dateStr.split('/');
            if (day && month && year && day.length <= 2 && month.length <= 2 && year.length === 4) {
              const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              if (!isNaN(parsedDate.getTime())) {
                dateAdded = parsedDate.toISOString();
              }
            }
          } else {
            // Try to parse as is
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              dateAdded = parsedDate.toISOString();
            }
          }
        }
        
        const noteRecord = {
          order_id: orderId,
          created_at: dateAdded,
          status: record['Order Status']?.trim()?.substring(0, 50) || null,
          content: record['Order Status'] && record['Comment'] 
            ? `${record['Order Status'].trim()} - ${record['Comment'].trim()}`
            : record['Order Status']?.trim() || record['Comment']?.trim() || null
        };
        
        // Final validation - ensure order_id is a valid UUID format
        if (!orderId || typeof orderId !== 'string' || !orderId.includes('-') || orderId.length < 30) {
          console.error(`❌ Invalid order_id format: ${orderId} for order ${orderNumber}`);
          continue;
        }
        
        // Debug: Log first few records to see what's being inserted
        if (notesProcessed < 3) {
          console.log(`🔍 Debug: Record ${notesProcessed + 1}:`, {
            orderNumber,
            orderId,
            status: noteRecord.status,
            content: noteRecord.content?.substring(0, 50) + '...'
          });
        }
        
        customerNotesData.push(noteRecord);
        notesProcessed++;
      } else {
        ordersNotFound++;
        if (ordersNotFound <= 5) { // Show first 5 missing orders
          console.log(`⚠️ Order not found for customer note: ${orderNumber}`);
        }
      }
    }

    console.log(`📊 Created ${customerNotesData.length} customer note records`);
    console.log(`📊 Orders not found: ${ordersNotFound}`);

    // Step 5: Import customer notes in batches
    console.log("\n📝 STEP 5: Importing customer notes in batches...");
    
    const batchSize = 2000;
    let notesCreated = 0;
    
    for (let i = 0; i < customerNotesData.length; i += batchSize) {
      const batch = customerNotesData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(customerNotesData.length / batchSize);
      
      console.log(`📝 Processing notes batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const { error } = await supabase
          .from("order_customer_notes")
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting customer notes batch ${batchNumber}:`, error.message);
        } else {
          notesCreated += batch.length;
          console.log(`✅ Notes batch ${batchNumber} inserted successfully (${batch.length} records)`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error in notes batch ${batchNumber}:`, err.message);
      }
      
      // Progress update
      const progress = Math.round(((i + batch.length) / customerNotesData.length) * 100);
      console.log(`📊 Progress: ${Math.min(i + batch.length, customerNotesData.length)}/${customerNotesData.length} (${progress}%) - Created: ${notesCreated}`);
    }

    // Step 6: Final status
    console.log("\n" + "=".repeat(70));
    console.log("🔄 CUSTOMER NOTES IMPORT COMPLETED");
    
    const { count: finalNotesCount } = await supabase.from('order_customer_notes').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL NOTES COUNT: ${finalNotesCount}`);
    console.log(`📊 NOTES FROM CSV: ${customerNotesData.length}`);
    console.log(`📊 NOTES CREATED: ${notesCreated}`);
    console.log(`📊 ORDERS NOT FOUND: ${ordersNotFound}`);
    
    if (notesCreated === customerNotesData.length) {
      console.log("✅ All customer notes processed successfully!");
    } else {
      console.log(`⚠️ Processing mismatch: Expected ${customerNotesData.length}, processed ${notesCreated}`);
    }

    console.log("\n✅ Customer notes import completed!");
    console.log("📊 All customer notes imported with proper order mapping");

  } catch (error) {
    console.error("❌ Error during customer notes import:", error);
  }
}

importCustomerNotes();