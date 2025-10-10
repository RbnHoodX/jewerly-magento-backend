require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const { parse } = require("csv-parse/sync");
const fs = require("fs");
const path = require("path");

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

async function importOrderItems() {
  console.log("📦 IMPORTING ORDER ITEMS FROM CSV");
  console.log("=".repeat(70));
  
  // Check if we're in a transaction
  console.log("\n⚠️ IMPORTANT: Make sure you've started a transaction with 'BEGIN;' in Supabase dashboard");
  console.log("After running this script, check the results and either:");
  console.log("  - COMMIT; (if everything looks good)");
  console.log("  - ROLLBACK; (if something went wrong)");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear all existing order items
    console.log("\n🗑️ STEP 1: Clearing all existing order items...");
    
    const { error: clearError } = await supabase
      .from("order_items")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (clearError) {
      console.error("❌ Error clearing order items:", clearError.message);
      return;
    }
    
    console.log("✅ All existing order items cleared");

    // Step 2: Get all orders for mapping
    console.log("\n📊 STEP 2: Getting all orders for order items mapping...");
    
    const orderLookup = new Map();
    let allOrders = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, order_id")
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (ordersError) {
        console.error("❌ Error fetching orders:", ordersError.message);
        return;
      }

      if (orders.length === 0) {
        hasMore = false;
      } else {
        allOrders = allOrders.concat(orders);
        orders.forEach(order => {
          orderLookup.set(order.order_id, order.id);
        });
        page++;
      }
    }

    console.log(`✅ Found ${allOrders.length} orders for mapping`);

    // Step 3: Read and parse CSV file
    console.log("\n📄 STEP 3: Reading CSV file...");
    
    const csvPath = path.join(MIGRATION_DIR, "main_page_updated.csv");
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvPath}`);
      return;
    }

    const csvContent = fs.readFileSync(csvPath, "utf-8");
    
    // Parse CSV content using sync method
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    console.log(`✅ CSV file loaded with ${records.length} records`);

    // Step 4: Process records and create order items
    console.log("\n🔄 STEP 4: Processing records and creating order items...");
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const batchSize = 100;
    let batch = [];

    for (const record of records) {
      try {
        const orderNumber = record["Order #"];
        
        if (!orderNumber) {
          console.log(`⚠️ Skipping record with no order number`);
          skippedCount++;
          continue;
        }

        // Find the order ID using the order number
        const orderId = orderLookup.get(orderNumber);
        
        if (!orderId) {
          console.log(`⚠️ Order not found for order number: ${orderNumber}`);
          skippedCount++;
          continue;
        }

        // Process up to 10 items per order (based on CSV structure)
        for (let i = 1; i <= 10; i++) {
          const sku = record[`SKU ${i}`];
          const productOptions = record[`Product Options ${i}`];
          const price = record[`Price ${i}`];
          const qty = record[`Qty ${i}`];
          const productImage = record[`Product Image ${i}`];

          // Skip if no SKU (empty item)
          if (!sku || sku.trim() === '') {
            continue;
          }

          const orderItem = {
            order_id: orderId,
            sku: sku.trim(),
            size: productOptions ? productOptions.trim() : null,
            metal_type: null, // Not available in CSV
            details: null, // Not available in CSV
            price: price ? parseFloat(price) : 0,
            qty: qty ? parseInt(qty) : 1,
            image: productImage ? productImage.trim() : null,
          };

          batch.push(orderItem);

          // Insert batch when it reaches batchSize
          if (batch.length >= batchSize) {
            const { error: insertError } = await supabase
              .from("order_items")
              .insert(batch);

            if (insertError) {
              console.error(`❌ Error inserting batch:`, insertError.message);
              errorCount += batch.length;
            } else {
              createdCount += batch.length;
              console.log(`✅ Inserted batch of ${batch.length} items (Total: ${createdCount})`);
            }

            batch = [];
          }
        }

      } catch (error) {
        console.error(`❌ Error processing record:`, error.message);
        errorCount++;
      }
    }

    // Insert remaining items in the last batch
    if (batch.length > 0) {
      const { error: insertError } = await supabase
        .from("order_items")
        .insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting final batch:`, insertError.message);
        errorCount += batch.length;
      } else {
        createdCount += batch.length;
        console.log(`✅ Inserted final batch of ${batch.length} items (Total: ${createdCount})`);
      }
    }

    // Step 5: Summary
    console.log("\n📊 STEP 5: Import Summary");
    console.log("=".repeat(50));
    console.log(`✅ Created new items: ${createdCount}`);
    console.log(`📦 Total processed: ${createdCount} order items`);
    console.log(`⚠️ Skipped records: ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📄 Total CSV records: ${records.length}`);

    // Step 6: Verify import
    console.log("\n🔍 STEP 6: Verifying import...");
    
    const { data: itemCount, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Error verifying import:", countError.message);
    } else {
      console.log(`✅ Total order items in database: ${itemCount}`);
    }

    console.log("\n🎉 Order items import completed successfully!");

  } catch (error) {
    console.error("❌ Fatal error during import:", error);
    process.exit(1);
  }
}

// Run the import
importOrderItems()
  .then(() => {
    console.log("✅ Import script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Import script failed:", error);
    process.exit(1);
  });
