import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import * as fs from "fs";
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

async function import3DRelated() {
  console.log("🎨 IMPORTING 3D RELATED DATA FROM CSV");
  console.log("=".repeat(70));

  try {
    // Step 1: Clear existing 3D related data
    console.log("\n🗑️ STEP 1: Clearing existing 3D related data...");
    
    const { error: clearError } = await supabase
      .from("order_3d_related")
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (clearError) {
      console.log(`⚠️ Warning clearing order_3d_related: ${clearError.message}`);
    } else {
      console.log(`✅ Cleared order_3d_related table`);
    }

    // Step 2: Get all orders for mapping
    console.log("\n📦 STEP 2: Getting all orders for 3D mapping...");
    
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

    // Step 3: Process 3D related CSV
    console.log("\n📊 STEP 3: Processing 3D related CSV...");
    
    const threeDCsvPath = path.join(MIGRATION_DIR, "3drelated.csv");
    const threeDFileContent = fs.readFileSync(threeDCsvPath, "utf8");
    const threeDRecords = parse(threeDFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${threeDRecords.length} 3D related records`);

    // Step 4: Extract 3D related data
    console.log("\n🎨 STEP 4: Extracting 3D related data...");
    
    const threeDData = [];
    let threeDProcessed = 0;
    let ordersNotFound = 0;
    
    for (let recordIndex = 0; recordIndex < threeDRecords.length; recordIndex++) {
      const record = threeDRecords[recordIndex];
      const orderNumber = record['Order #']?.toString();
      
      if (orderNumber && orderLookup.has(orderNumber)) {
        const orderId = orderLookup.get(orderNumber);
        
        // Parse date from DD/MM/YYYY format to ISO
        let dateAdded = new Date().toISOString();
        if (record['Date']) {
          const dateStr = record['Date'].trim();
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
        
        // Find all attachment columns for this record (Attachment 1, Attachment 2, etc.)
        const attachmentColumns = Object.keys(record).filter(key => key.startsWith('Attachment '));
        
        for (const attachmentColumn of attachmentColumns) {
          const attachmentNumber = attachmentColumn.replace('Attachment ', '');
          const attachmentValue = record[attachmentColumn]?.trim();
          
          if (attachmentValue) {
            let imageUrl = attachmentValue;
            let imageName = `attachment_${attachmentNumber}`;
            
            // Check for HYPERLINK formula (same as employee comments)
            if (attachmentValue.includes('=HYPERLINK(')) {
              const match = attachmentValue.match(/=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)/i);
              if (match) {
                imageUrl = match[1]; // Extract the URL
                imageName = match[2]; // Extract the display text
              }
            }
            // Check if it's a hyperlink (contains HTML or is a URL)
            else if (attachmentValue.includes('<a href=') || attachmentValue.includes('http')) {
              // Extract URL from hyperlink
              const urlMatch = attachmentValue.match(/https?:\/\/[^\s"']+/);
              if (urlMatch) {
                imageUrl = urlMatch[0];
                imageName = imageUrl.split('/').pop() || `attachment_${attachmentNumber}`;
              }
            } else if (attachmentValue.startsWith('http')) {
              // Direct URL
              imageUrl = attachmentValue;
              imageName = imageUrl.split('/').pop() || `attachment_${attachmentNumber}`;
            } else {
              // Plain text or filename
              imageUrl = attachmentValue;
              imageName = attachmentValue;
            }
            
            const threeDRecord = {
              order_id: orderId,
              date_added: dateAdded,
              image_url: imageUrl,
              image_name: imageName,
              added_by: null, // Set to null as per previous requirements
              created_at: new Date().toISOString()
            };
            
            threeDData.push(threeDRecord);
            threeDProcessed++;
          }
        }
      } else {
        ordersNotFound++;
        if (ordersNotFound <= 5) { // Show first 5 missing orders
          console.log(`⚠️ Order not found for 3D record: ${orderNumber}`);
        }
      }
    }

    console.log(`📊 Created ${threeDData.length} 3D related records`);
    console.log(`📊 Orders not found: ${ordersNotFound}`);

    // Step 5: Import 3D related data in batches
    console.log("\n🎨 STEP 5: Importing 3D related data in batches...");
    
    const batchSize = 2000;
    let threeDCreated = 0;
    
    for (let i = 0; i < threeDData.length; i += batchSize) {
      const batch = threeDData.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(threeDData.length / batchSize);
      
      console.log(`🎨 Processing 3D batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      try {
        const { error } = await supabase
          .from("order_3d_related")
          .insert(batch);

        if (error) {
          console.error(`❌ Error inserting 3D batch ${batchNumber}:`, error.message);
        } else {
          threeDCreated += batch.length;
          console.log(`✅ 3D batch ${batchNumber} inserted successfully (${batch.length} records)`);
        }
      } catch (err) {
        console.error(`❌ Unexpected error in 3D batch ${batchNumber}:`, err.message);
      }
      
      // Progress update
      const progress = Math.round(((i + batch.length) / threeDData.length) * 100);
      console.log(`📊 Progress: ${Math.min(i + batch.length, threeDData.length)}/${threeDData.length} (${progress}%) - Created: ${threeDCreated}`);
    }

    // Step 6: Final status
    console.log("\n" + "=".repeat(70));
    console.log("🔄 3D RELATED IMPORT COMPLETED");
    
    const { count: final3DCount } = await supabase.from('order_3d_related').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL 3D COUNT: ${final3DCount}`);
    console.log(`📊 3D FROM CSV: ${threeDData.length}`);
    console.log(`📊 3D CREATED: ${threeDCreated}`);
    console.log(`📊 ORDERS NOT FOUND: ${ordersNotFound}`);
    
    if (threeDCreated === threeDData.length) {
      console.log("✅ All 3D related data processed successfully!");
    } else {
      console.log(`⚠️ Processing mismatch: Expected ${threeDData.length}, processed ${threeDCreated}`);
    }

    console.log("\n✅ 3D related import completed!");
    console.log("📊 All 3D related data imported with proper order mapping");

  } catch (error) {
    console.error("❌ Error during 3D related import:", error);
  }
}

import3DRelated();