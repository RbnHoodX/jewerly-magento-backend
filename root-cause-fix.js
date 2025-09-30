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

async function rootCauseFix() {
  console.log("🎯 ROOT CAUSE FIX - TARGETED SOLUTION");
  console.log("=".repeat(60));

  try {
    // 1. Get existing data
    console.log("\n📊 Getting existing data...");
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("email, customer_id");
    
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_id");

    const existingCustomerEmails = new Set(existingCustomers.map(c => c.email.toLowerCase()));
    const existingCustomerIds = new Set(existingCustomers.map(c => c.customer_id));
    const existingOrderIds = new Set(existingOrders.map(o => o.order_id));

    console.log(`📊 Found ${existingCustomerEmails.size} existing customers`);
    console.log(`📊 Found ${existingOrderIds.size} existing orders`);

    // 2. Read CSV and identify truly missing customers
    console.log("\n📊 Analyzing CSV for missing customers...");
    const mainCsvPath = path.join(MIGRATION_DIR, "main_page.csv");
    const mainFileContent = fs.readFileSync(mainCsvPath, "utf8");
    const mainRecords = parse(mainFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    const missingCustomers = [];
    const customerMap = new Map();

    for (const record of mainRecords) {
      const customerId = record["Customer Id"]?.toString();
      const email = record["Customer Email"]?.trim();
      const firstName = record["Billing First Name:"]?.trim();
      const lastName = record["Billing Last Name"]?.trim();
      
      if (email && firstName && lastName && customerId) {
        const emailKey = email.toLowerCase();
        
        // Skip if customer already exists
        if (existingCustomerEmails.has(emailKey) || existingCustomerIds.has(customerId)) {
          continue;
        }
        
        // Skip if we've already processed this customer
        if (customerMap.has(emailKey)) {
          continue;
        }
        
        customerMap.set(emailKey, true);
        
        // Build customer data
        const billingAddr = [
          record["Billing Street1"]?.trim(),
          record["Billing City"]?.trim(),
          record["Billing Region"]?.trim(),
          record["Billing PostCode"]?.trim(),
          record["Billing Country"]?.trim()
        ].filter(Boolean).join(", ");

        const shippingAddr = [
          record["Shipping Street1"]?.trim(),
          record["Shipping City"]?.trim(),
          record["Shipping Region"]?.trim(),
          record["Shipping PostCode"]?.trim(),
          record["Shipping Country"]?.trim()
        ].filter(Boolean).join(", ");

        missingCustomers.push({
          customer_id: customerId,
          name: `${firstName} ${lastName}`,
          email: email,
          first_name: firstName,
          last_name: lastName,
          phone: record["Billing Tel"]?.trim() || record["Shipping Tel"]?.trim() || null,
          billing_addr: billingAddr || null,
          shipping_addr: shippingAddr || null,
          created_at: new Date().toISOString()
        });
      }
    }

    console.log(`📊 Found ${missingCustomers.length} truly missing customers`);

    // Import missing customers in batches with proper error handling
    if (missingCustomers.length > 0) {
      console.log("\n👥 Importing missing customers...");
      const customerBatchSize = 500;
      let customersCreated = 0;
      
      for (let i = 0; i < missingCustomers.length; i += customerBatchSize) {
        const batch = missingCustomers.slice(i, i + customerBatchSize);
        console.log(`👥 Processing customer batch ${Math.floor(i / customerBatchSize) + 1}/${Math.ceil(missingCustomers.length / customerBatchSize)} (${batch.length} customers)`);
        
        try {
          const { data, error } = await supabase
            .from("customers")
            .insert(batch)
            .select();

          if (error) {
            console.log(`⚠️  Batch insert failed, trying individual inserts...`);
            // Try individual inserts for this batch
            for (const customer of batch) {
              try {
                const { error: individualError } = await supabase
                  .from("customers")
                  .insert(customer);
                
                if (!individualError) {
                  customersCreated++;
                }
              } catch (err) {
                // Skip duplicates silently
              }
            }
          } else {
            customersCreated += batch.length;
            console.log(`✅ Inserted ${batch.length} customers`);
          }
        } catch (err) {
          console.log(`⚠️  Batch failed, trying individual inserts...`);
          for (const customer of batch) {
            try {
              const { error: individualError } = await supabase
                .from("customers")
                .insert(customer);
              
              if (!individualError) {
                customersCreated++;
              }
            } catch (err) {
              // Skip duplicates silently
            }
          }
        }
      }
      
      console.log(`✅ Created ${customersCreated} new customers`);
    }

    // 3. Get updated customer mapping
    console.log("\n📊 Getting updated customer mapping...");
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, email, customer_id");

    const customerEmailMap = new Map();
    const customerIdMap = new Map();
    allCustomers.forEach(customer => {
      customerEmailMap.set(customer.email.toLowerCase(), customer.id);
      if (customer.customer_id) {
        customerIdMap.set(customer.customer_id, customer.id);
      }
    });

    console.log(`📊 Updated customer mapping: ${allCustomers.length} customers`);

    // 4. Import missing orders with improved customer matching
    console.log("\n📦 Importing missing orders...");
    const missingOrders = [];
    const orderItemsMap = new Map();
    let skippedNoCustomer = 0;

    for (const record of mainRecords) {
      const orderNumber = record["Order #"]?.toString();
      const customerId = record["Customer Id"]?.toString();
      const email = record["Customer Email"]?.trim();
      
      // Skip if order already exists
      if (existingOrderIds.has(orderNumber)) {
        continue;
      }
      
      // Find customer with multiple strategies
      let customerDbId = null;
      
      // Strategy 1: Try customer_id
      if (customerId) {
        customerDbId = customerIdMap.get(customerId);
      }
      
      // Strategy 2: Try email
      if (!customerDbId && email) {
        customerDbId = customerEmailMap.get(email.toLowerCase());
      }
      
      // Strategy 3: Try partial email matching
      if (!customerDbId && email) {
        const emailParts = email.toLowerCase().split('@');
        if (emailParts.length === 2) {
          const [localPart, domain] = emailParts;
          for (const [existingEmail, existingId] of customerEmailMap.entries()) {
            if (existingEmail.includes(localPart) || existingEmail.includes(domain)) {
              customerDbId = existingId;
              break;
            }
          }
        }
      }
      
      if (!customerDbId) {
        skippedNoCustomer++;
        continue;
      }

      // Calculate total amount
      let totalAmount = 0;
      for (let i = 1; i <= 10; i++) {
        const subtotal = parseFloat(record[`Row Subtotal ${i}`] || "0");
        totalAmount += subtotal;
      }

      const order = {
        customer_id: customerDbId,
        order_id: orderNumber,
        shopify_order_number: orderNumber,
        order_date: record["Order Date"] || new Date().toISOString(),
        total_amount: totalAmount,
        purchase_from: "CSV Import",
        delivery_method: "Standard",
        bill_to_name: `${record["Billing First Name:"] || ""} ${record["Billing Last Name"] || ""}`.trim(),
        ship_to_name: `${record["Shipping First Name:"] || ""} ${record["Shipping Last Name"] || ""}`.trim(),
        customization_notes: record["Customization Notes"]?.trim() || null,
        created_at: new Date().toISOString()
      };

      missingOrders.push(order);

      // Collect order items
      const orderItems = [];
      for (let i = 1; i <= 10; i++) {
        const productInfo = record[`product Information ${i}`];
        const productImage = record[`Product Image ${i}`];
        const sku = record[`SKU ${i}`];
        const stockNumber = record[`Stock Number ${i}`];
        const price = record[`Price ${i}`];
        const qty = record[`Qty ${i}`];
        const comment = record[`Comment ${i}`];
        
        if (productInfo && productInfo.trim() && productInfo !== "nan") {
          const imageUrl = productImage && !productImage.startsWith("http")
            ? `https://old-admin.primestyle.com/cron/custom-product/${productImage}`
            : productImage || null;

          const details = [productInfo.trim(), comment?.trim()].filter(Boolean).join(" - ");

          orderItems.push({
            sku: sku?.trim() || stockNumber?.trim() || productInfo.trim(),
            image: imageUrl,
            details: details,
            price: parseFloat(price || "0"),
            qty: parseInt(qty || "1"),
            created_at: new Date().toISOString()
          });
        }
      }
      
      if (orderItems.length > 0) {
        orderItemsMap.set(orderNumber, orderItems);
      }
    }

    console.log(`📊 Found ${missingOrders.length} missing orders`);
    console.log(`📊 Skipped ${skippedNoCustomer} orders (no customer found)`);

    // Import missing orders in batches
    if (missingOrders.length > 0) {
      const orderBatchSize = 1000;
      let ordersCreated = 0;
      
      for (let i = 0; i < missingOrders.length; i += orderBatchSize) {
        const batch = missingOrders.slice(i, i + orderBatchSize);
        console.log(`📦 Processing order batch ${Math.floor(i / orderBatchSize) + 1}/${Math.ceil(missingOrders.length / orderBatchSize)} (${batch.length} orders)`);
        
        try {
          const { data: insertedOrders, error } = await supabase
            .from("orders")
            .insert(batch)
            .select("id, order_id");

          if (error) {
            console.log(`⚠️  Batch insert failed, trying individual inserts...`);
            // Try individual inserts for this batch
            for (const order of batch) {
              try {
                const { data: insertedOrder, error: individualError } = await supabase
                  .from("orders")
                  .insert(order)
                  .select("id, order_id");
                
                if (!individualError && insertedOrder && insertedOrder.length > 0) {
                  ordersCreated++;
                  
                  // Insert order items
                  const orderItems = orderItemsMap.get(order.order_id) || [];
                  if (orderItems.length > 0) {
                    const orderItemsWithOrderId = orderItems.map(item => ({
                      order_id: insertedOrder[0].id,
                      ...item
                    }));
                    
                    await supabase
                      .from("order_items")
                      .insert(orderItemsWithOrderId);
                  }
                }
              } catch (err) {
                // Skip duplicates silently
              }
            }
          } else {
            ordersCreated += insertedOrders.length;
            console.log(`✅ Inserted ${insertedOrders.length} orders`);

            // Insert order items for this batch
            const batchOrderItems = [];
            insertedOrders.forEach(order => {
              const orderItems = orderItemsMap.get(order.order_id) || [];
              orderItems.forEach(item => {
                batchOrderItems.push({
                  order_id: order.id,
                  ...item
                });
              });
            });

            if (batchOrderItems.length > 0) {
              const itemBatchSize = 500;
              for (let j = 0; j < batchOrderItems.length; j += itemBatchSize) {
                const itemBatch = batchOrderItems.slice(j, j + itemBatchSize);
                
                const { error: itemsError } = await supabase
                  .from("order_items")
                  .insert(itemBatch);

                if (itemsError) {
                  console.error("❌ Error inserting order items batch:", itemsError.message);
                } else {
                  console.log(`✅ Inserted ${itemBatch.length} order items`);
                }
              }
            }
          }
        } catch (err) {
          console.log(`⚠️  Batch failed, trying individual inserts...`);
          for (const order of batch) {
            try {
              const { data: insertedOrder, error: individualError } = await supabase
                .from("orders")
                .insert(order)
                .select("id, order_id");
              
              if (!individualError && insertedOrder && insertedOrder.length > 0) {
                ordersCreated++;
                
                // Insert order items
                const orderItems = orderItemsMap.get(order.order_id) || [];
                if (orderItems.length > 0) {
                  const orderItemsWithOrderId = orderItems.map(item => ({
                    order_id: insertedOrder[0].id,
                    ...item
                  }));
                  
                  await supabase
                    .from("order_items")
                    .insert(orderItemsWithOrderId);
                }
              }
            } catch (err) {
              // Skip duplicates silently
            }
          }
        }
      }
      
      console.log(`✅ Created ${ordersCreated} new orders`);
    }

    // 5. Import all missing 3D related data
    console.log("\n🎨 Importing all 3D related data...");
    const threeDCsvPath = path.join(MIGRATION_DIR, "3drelated.csv");
    if (fs.existsSync(threeDCsvPath)) {
      const threeDFileContent = fs.readFileSync(threeDCsvPath, "utf8");
      const threeDRecords = parse(threeDFileContent, {
        columns: true,
        skip_empty_lines: true,
      });

      // Get all existing orders for mapping
      const { data: allOrders } = await supabase
        .from("orders")
        .select("id, order_id");

      const orderIdMap = new Map();
      allOrders.forEach(order => {
        orderIdMap.set(order.order_id, order.id);
      });

      const threeDItems = [];
      let threeDSkipped = 0;

      for (const record of threeDRecords) {
        const orderNumber = record["Order #"]?.toString();
        const orderId = orderIdMap.get(orderNumber);

        if (!orderId) {
          threeDSkipped++;
          continue;
        }

        // Process all attachment columns
        for (let i = 1; i <= 49; i++) {
          const attachment = record[`Attachment ${i}`];
          if (attachment && attachment.trim()) {
            const imageUrl = attachment.startsWith("http")
              ? attachment
              : `https://old-admin.primestyle.com/cron/custom-product/${attachment}`;

            threeDItems.push({
              order_id: orderId,
              image_url: imageUrl,
              image_name: attachment.trim(),
              created_at: record["Date"] || new Date().toISOString()
            });
          }
        }
      }

      console.log(`📊 Found ${threeDItems.length} 3D items to import`);
      console.log(`📊 Skipped ${threeDSkipped} 3D records (no order found)`);

      // Import 3D items in batches
      if (threeDItems.length > 0) {
        const threeDBatchSize = 500;
        let threeDCreated = 0;
        
        for (let i = 0; i < threeDItems.length; i += threeDBatchSize) {
          const batch = threeDItems.slice(i, i + threeDBatchSize);
          console.log(`🎨 Processing 3D batch ${Math.floor(i / threeDBatchSize) + 1}/${Math.ceil(threeDItems.length / threeDBatchSize)} (${batch.length} items)`);
          
          const { error } = await supabase
            .from("order_3d_related")
            .insert(batch);

          if (error) {
            console.error("❌ Error inserting 3D batch:", error.message);
          } else {
            threeDCreated += batch.length;
            console.log(`✅ Inserted ${batch.length} 3D items`);
          }
        }
        
        console.log(`✅ Created ${threeDCreated} 3D items`);
      }
    }

    // 6. Final summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ROOT CAUSE FIX COMPLETED!");
    
    // Get final counts
    const { count: finalCustomerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    const { count: finalOrderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: finalOrderItemCount } = await supabase.from('order_items').select('*', { count: 'exact', head: true });
    const { count: finalThreeDCount } = await supabase.from('order_3d_related').select('*', { count: 'exact', head: true });
    
    console.log(`📊 FINAL DATABASE COUNTS:`);
    console.log(`  - Customers: ${finalCustomerCount}`);
    console.log(`  - Orders: ${finalOrderCount}`);
    console.log(`  - Order Items: ${finalOrderItemCount}`);
    console.log(`  - 3D Related: ${finalThreeDCount}`);

  } catch (error) {
    console.error("❌ Error during root cause fix:", error);
  }
}

rootCauseFix();
