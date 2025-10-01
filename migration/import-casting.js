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

async function importCasting() {
  console.log("🏭 IMPORTING CASTING DATA FROM CSV");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear existing casting data
    console.log("\n🗑️ STEP 1: Clearing existing casting data...");
    
    const { error: clearError } = await supabase
      .from("order_casting")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (clearError) {
      console.log(`⚠️ Warning clearing order_casting: ${clearError.message}`);
    } else {
      console.log(`✅ Cleared order_casting table`);
    }

    // Step 2: Get all orders for mapping
    console.log("\n📦 STEP 2: Getting all orders for casting mapping...");
    
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

    // Step 3: Process casting CSV
    console.log("\n📊 STEP 3: Processing casting CSV...");
    
    const castingCsvPath = path.join(MIGRATION_DIR, "casting.csv");
    const castingFileContent = fs.readFileSync(castingCsvPath, "utf8");
    const castingRecords = parse(castingFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${castingRecords.length} casting records`);

    // Step 4: Extract casting data
    console.log("\n🏭 STEP 4: Extracting casting data...");
    
    const castingData = [];
    let castingProcessed = 0;
    let ordersNotFound = 0;
    
    for (const record of castingRecords) {
      const orderNumber = record['Order #']?.toString();
      
      if (orderNumber && orderLookup.has(orderNumber)) {
        const orderId = orderLookup.get(orderNumber);
        
        // Parse date from DD/MM/YYYY format to ISO
        let dateAdded = new Date().toISOString();
        if (record['Date Added']) {
          const dateStr = record['Date Added'].trim();
          if (dateStr.includes('/')) {
            // Handle DD/MM/YYYY format
            const [day, month, year] = dateStr.split('/');
            if (day && month && year) {
              dateAdded = new Date(year, month - 1, day).toISOString();
            }
          } else {
            // Try to parse as is
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
              dateAdded = parsedDate.toISOString();
            }
          }
        }
        
        const castingRecord = {
          order_id: orderId,
          date_added: dateAdded,
          supplier: record['Supplier']?.trim() || null,
          metal_type: record['Metal Type']?.trim() || null,
          quantity: parseInt(record['Qty']) || 0,
          weight: parseFloat(record['Weight']) || 0,
          weight_unit: "g",
          price: parseFloat(record['Price']?.toString().replace(/[$,]/g, '')) || parseFloat(record['price']?.toString().replace(/[$,]/g, '')) || 0,
          created_at: new Date().toISOString()
        };
        
        castingData.push(castingRecord);
        castingProcessed++;
      } else {
        ordersNotFound++;
        if (ordersNotFound <= 5) { // Show first 5 missing orders
          console.log(`⚠️ Order not found for casting: ${orderNumber}`);
        }
      }
    }

    console.log(`📊 Created ${castingData.length} casting records`);
    console.log(`📊 Orders not found: ${ordersNotFound}`);

    // Step 5: Import casting data in batches
    console.log("\n🏭 STEP 5: Importing casting data in batches...");
    
    const batchSize = 2000;
    let castingCreated = 0;
    
    for (let i = 0; i < castingData.length; i += batchSize) {
      const batch = castingData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(castingData.length / batchSize);
      
      console.log(`🏭 Processing casting batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const { error } = await supabase
          .from("order_casting")
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting casting batch ${batchNumber}:`, error.message);
        } else {
          castingCreated += batch.length;
          console.log(`✅ Casting batch ${batchNumber} inserted successfully (${batch.length} records)`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error in casting batch ${batchNumber}:`, err.message);
      }
      
      // Progress update
      const progress = Math.round(((i + batch.length) / castingData.length) * 100);
      console.log(`📊 Progress: ${Math.min(i + batch.length, castingData.length)}/${castingData.length} (${progress}%) - Created: ${castingCreated}`);
    }

    // Step 6: Final status
    console.log("\n" + "=".repeat(70));
    console.log("🔄 CASTING IMPORT COMPLETED");
    
    const { count: finalCastingCount } = await supabase.from('order_casting').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL CASTING COUNT: ${finalCastingCount}`);
    console.log(`📊 CASTING FROM CSV: ${castingData.length}`);
    console.log(`📊 CASTING CREATED: ${castingCreated}`);
    console.log(`📊 ORDERS NOT FOUND: ${ordersNotFound}`);
    
    if (castingCreated === castingData.length) {
      console.log("✅ All casting data processed successfully!");
    } else {
      console.log(`⚠️ Processing mismatch: Expected ${castingData.length}, processed ${castingCreated}`);
    }

    console.log("\n✅ Casting import completed!");
    console.log("📊 All casting data imported with proper order mapping");

  } catch (error) {
    console.error("❌ Error during casting import:", error);
  }
}

importCasting();