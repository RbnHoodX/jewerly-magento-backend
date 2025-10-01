import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import fs from "fs";
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

async function importDiamondDeductions() {
  console.log("💎 IMPORTING DIAMOND DEDUCTIONS");
  console.log("=".repeat(50));

  try {
    // Step 1: Clear existing diamond deductions
    console.log("🗑️ Step 1: Clearing existing diamond deductions...");
    const { error: clearError } = await supabase
      .from('diamond_deductions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (clearError) {
      console.error("❌ Error clearing diamond deductions:", clearError.message);
      return;
    }
    console.log("✅ Diamond deductions table cleared");

    // Step 2: Fetch all orders for mapping
    console.log("\n📊 Step 2: Fetching all orders for mapping...");
    const allOrders = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_id, shopify_order_number')
        .range(from, from + pageSize - 1);

      if (ordersError) {
        console.error("❌ Error fetching orders:", ordersError.message);
        return;
      }

      if (orders.length === 0) {
        hasMore = false;
      } else {
        allOrders.push(...orders);
        from += pageSize;
        console.log(`📊 Fetched ${allOrders.length} orders so far...`);
      }
    }

    console.log(`✅ Total orders fetched: ${allOrders.length}`);

    // Create order lookup map
    const orderLookup = new Map();
    allOrders.forEach(order => {
      // Map by order_id (Order #)
      if (order.order_id) {
        orderLookup.set(order.order_id.toString(), order.id);
      }
      // Also map by shopify_order_number as fallback
      if (order.shopify_order_number) {
        orderLookup.set(order.shopify_order_number.toString(), order.id);
      }
    });

    console.log(`📊 Order lookup map created with ${orderLookup.size} entries`);

    // Step 3: Parse CSV file
    console.log("\n📊 Step 3: Parsing Diamonds.csv...");
    const csvPath = path.join(process.cwd(), 'migration', 'Diamonds.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error("❌ Diamonds.csv file not found at:", csvPath);
      return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const records = [];
    
    await new Promise((resolve, reject) => {
      parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (err, data) => {
        if (err) {
          reject(err);
        } else {
          records.push(...data);
          resolve();
        }
      });
    });

    console.log(`✅ Parsed ${records.length} diamond deduction records`);

    // Step 4: Process and map data
    console.log("\n📊 Step 4: Processing diamond deduction data...");
    const diamondDeductionsData = [];
    let processedCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const orderNumber = record['Order #']?.trim();
      
      // Skip invalid order numbers
      if (!orderNumber || orderNumber === 'System' || orderNumber === 'undefined' || 
          orderNumber === 'null' || orderNumber === '0' || isNaN(Number(orderNumber))) {
        skippedCount++;
        continue;
      }

      // Find order ID
      const orderId = orderLookup.get(orderNumber);
      if (!orderId) {
        console.log(`⚠️ No order found for Order #: ${orderNumber}`);
        skippedCount++;
        continue;
      }

      // Parse date
      let dateAdded = null;
      if (record['Date Added']) {
        try {
          // Handle DD/MM/YYYY format
          const dateParts = record['Date Added'].split('/');
          if (dateParts.length === 3) {
            const day = dateParts[0].padStart(2, '0');
            const month = dateParts[1].padStart(2, '0');
            const year = dateParts[2];
            dateAdded = new Date(`${year}-${month}-${day}`).toISOString();
          } else {
            dateAdded = new Date(record['Date Added']).toISOString();
          }
        } catch (error) {
          console.log(`⚠️ Invalid date format for Order # ${orderNumber}: ${record['Date Added']}`);
        }
      }

      const diamondDeduction = {
        order_id: orderId,
        date_added: dateAdded,
        product_sku: record['Product']?.trim() || null,
        parcel_id: record['Parcel ID']?.trim() || null,
        ct_weight: record['CT Weight'] ? parseFloat(record['CT Weight']) : null,
        stones: record['Stones'] ? parseInt(record['Stones']) : null,
        total_price: record['Total Price'] ? parseFloat(record['Total Price']) : null,
        mm: record['MM']?.trim() || null,
        comments: record['Comments']?.trim() || null,
        deduction_type: record['Type']?.trim() || null,
        price_per_ct: record['Price Per CT'] ? parseFloat(record['Price Per CT']) : null
      };

      // Validate required fields
      if (!diamondDeduction.order_id) {
        console.log(`⚠️ Missing order_id for Order #: ${orderNumber}`);
        skippedCount++;
        continue;
      }

      diamondDeductionsData.push(diamondDeduction);
      processedCount++;

      // Debug: Log first few records
      if (processedCount <= 3) {
        console.log(`🔍 Debug: Record ${processedCount}:`, {
          orderNumber,
          orderId: diamondDeduction.order_id,
          productSku: diamondDeduction.product_sku,
          ctWeight: diamondDeduction.ct_weight,
          totalPrice: diamondDeduction.total_price
        });
      }
    }

    console.log(`✅ Processed ${processedCount} diamond deductions`);
    console.log(`⚠️ Skipped ${skippedCount} invalid records`);

    if (diamondDeductionsData.length === 0) {
      console.log("❌ No valid diamond deductions to import");
      return;
    }

    // Step 5: Insert diamond deductions in batches
    console.log("\n📊 Step 5: Inserting diamond deductions...");
    const batchSize = 500;
    let insertedCount = 0;

    for (let i = 0; i < diamondDeductionsData.length; i += batchSize) {
      const batch = diamondDeductionsData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(diamondDeductionsData.length / batchSize);

      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

      const { error: insertError } = await supabase
        .from('diamond_deductions')
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${batchNumber}:`, insertError.message);
        console.log("🔍 Sample record from failed batch:", batch[0]);
        continue;
      }

      insertedCount += batch.length;
      console.log(`✅ Batch ${batchNumber} inserted successfully`);
    }

    console.log(`\n🎉 DIAMOND DEDUCTIONS IMPORT COMPLETED!`);
    console.log(`📊 Total inserted: ${insertedCount}`);
    console.log(`📊 Total processed: ${processedCount}`);
    console.log(`📊 Total skipped: ${skippedCount}`);

  } catch (error) {
    console.error("❌ Error during diamond deductions import:", error);
  }
}

importDiamondDeductions();
