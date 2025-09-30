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

async function restoreFromCSV() {
  console.log("🔄 RESTORING ALL DATA FROM CSV FILES");
  console.log("=".repeat(70));

  try {
    // Step 1: Import all customers from main CSV
    console.log("\n👥 STEP 1: Importing all customers from CSV...");
    
    const mainCsvPath = path.join(MIGRATION_DIR, "main_page.csv");
    const mainFileContent = fs.readFileSync(mainCsvPath, "utf8");
    const mainRecords = parse(mainFileContent, {
      columns: true,
      skip_empty_lines: true,
    });

    console.log(`📊 Processing ${mainRecords.length} CSV records`);

    // Get existing customers to avoid duplicates
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("email, customer_id");
    
    const existingCustomerEmails = new Set();
    const existingCustomerIds = new Set();
    
    existingCustomers.forEach(customer => {
      if (customer.email) existingCustomerEmails.add(customer.email.toLowerCase());
      if (customer.customer_id) existingCustomerIds.add(customer.customer_id.toString());
    });

    const customers = [];
    const customerEmailMap = new Map();
    
    for (const record of mainRecords) {
      const customerId = record['Customer Id']?.toString();
      const email = record['Customer Email']?.trim();
      const firstName = record['Customer First Name']?.trim();
      const lastName = record['Customer Last Name']?.trim();
      
      if (email && customerId) {
        const emailLower = email.toLowerCase();
        if (!existingCustomerEmails.has(emailLower) && !existingCustomerIds.has(customerId)) {
          customers.push({
            customer_id: customerId,
            email: email,
            first_name: firstName || 'Unknown',
            last_name: lastName || 'Customer',
            name: `${firstName || 'Unknown'} ${lastName || 'Customer'}`,
            phone: record['Customer Phone']?.trim() || null,
            company: record['Customer Company']?.trim() || null,
            created_at: new Date().toISOString()
          });
          customerEmailMap.set(emailLower, email);
        }
      }
    }

    console.log(`📊 Found ${customers.length} new customers to import`);

    // Import customers in batches
    if (customers.length > 0) {
      const customerBatchSize = 1000;
      let customersCreated = 0;
      
      for (let i = 0; i < customers.length; i += customerBatchSize) {
        const batch = customers.slice(i, i + customerBatchSize);
        
        const { error } = await supabase
          .from("customers")
          .insert(batch);

        if (error) {
          console.error("❌ Error inserting customers batch:", error.message);
        } else {
          customersCreated += batch.length;
          console.log(`✅ Inserted ${batch.length} customers`);
        }
      }
      
      console.log(`✅ Created ${customersCreated} customers`);
    }

    // Step 2: Get all customers for order mapping
    console.log("\n📊 STEP 2: Getting all customers for order mapping...");
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, email, customer_id");
    
    const customerLookup = new Map();
    allCustomers.forEach(customer => {
      if (customer.email) customerLookup.set(customer.email.toLowerCase(), customer.id);
      if (customer.customer_id) customerLookup.set(customer.customer_id.toString(), customer.id);
    });

    console.log(`📊 Found ${allCustomers.length} customers for mapping`);

    // Step 3: Import all orders from CSV
    console.log("\n📦 STEP 3: Importing all orders from CSV...");
    
    // Get existing orders to avoid duplicates
    const { data: existingOrders } = await supabase
      .from("orders")
      .select("order_id");
    
    const existingOrderIds = new Set();
    existingOrders.forEach(order => {
      if (order.order_id) existingOrderIds.add(order.order_id);
    });

    const orders = [];
    const orderItems = [];
    
    for (const record of mainRecords) {
      const orderNumber = record['Order #']?.toString();
      const customerId = record['Customer Id']?.toString();
      const customerEmail = record['Customer Email']?.trim();
      const itemName = record['Item Name']?.trim();
      const itemQuantity = record['Quantity']?.toString();
      const itemPrice = record['Price']?.toString();
      
      if (orderNumber && !existingOrderIds.has(orderNumber)) {
        // Find customer ID
        let customerDbId = null;
        if (customerId) {
          customerDbId = customerLookup.get(customerId);
        }
        if (!customerDbId && customerEmail) {
          customerDbId = customerLookup.get(customerEmail.toLowerCase());
        }
        
        if (customerDbId) {
          orders.push({
            order_id: orderNumber,
            customer_id: customerDbId,
            order_date: record['Order Date'] || new Date().toISOString(),
            total_amount: record['Total'] || '0',
            created_at: new Date().toISOString()
          });
          
          // Collect order items
          if (itemName && itemQuantity && itemPrice) {
            orderItems.push({
              order_id: orderNumber,
              item_name: itemName,
              quantity: parseInt(itemQuantity) || 1,
              price: parseFloat(itemPrice) || 0,
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }

    console.log(`📊 Found ${orders.length} new orders to import`);
    console.log(`📊 Found ${orderItems.length} order items to import`);

    // Import orders in batches
    if (orders.length > 0) {
      const orderBatchSize = 1000;
      let ordersCreated = 0;
      
      for (let i = 0; i < orders.length; i += orderBatchSize) {
        const batch = orders.slice(i, i + orderBatchSize);
        
        const { error } = await supabase
          .from("orders")
          .insert(batch);

        if (error) {
          console.error("❌ Error inserting orders batch:", error.message);
        } else {
          ordersCreated += batch.length;
          console.log(`✅ Inserted ${batch.length} orders`);
        }
      }
      
      console.log(`✅ Created ${ordersCreated} orders`);
    }

    // Step 4: Import order items
    if (orderItems.length > 0) {
      console.log("\n📦 STEP 4: Importing order items...");
      const itemBatchSize = 1000;
      let itemsCreated = 0;
      
      for (let i = 0; i < orderItems.length; i += itemBatchSize) {
        const batch = orderItems.slice(i, i + itemBatchSize);
        
        const { error } = await supabase
          .from("order_items")
          .insert(batch);

        if (error) {
          console.error("❌ Error inserting order items batch:", error.message);
        } else {
          itemsCreated += batch.length;
          console.log(`✅ Inserted ${batch.length} order items`);
        }
      }
      
      console.log(`✅ Created ${itemsCreated} order items`);
    }

    // Step 5: Import addresses with customer email
    console.log("\n🏠 STEP 5: Importing addresses with customer email...");
    
    // Get all orders for address mapping
    const { data: allOrders } = await supabase
      .from("orders")
      .select("id, order_id");
    
    const orderIdMap = new Map();
    allOrders.forEach(order => {
      orderIdMap.set(order.order_id, order.id);
    });

    // Get existing addresses to avoid duplicates
    const { data: existingBilling } = await supabase
      .from("order_billing_address")
      .select("order_id");
    
    const { data: existingShipping } = await supabase
      .from("order_shipping_address")
      .select("order_id");
    
    const existingBillingOrderIds = new Set();
    const existingShippingOrderIds = new Set();
    
    existingBilling.forEach(addr => {
      if (addr.order_id) existingBillingOrderIds.add(addr.order_id);
    });
    
    existingShipping.forEach(addr => {
      if (addr.order_id) existingShippingOrderIds.add(addr.order_id);
    });

    const billingAddresses = [];
    const shippingAddresses = [];
    
    for (const record of mainRecords) {
      const orderNumber = record['Order #']?.toString();
      const orderId = orderIdMap.get(orderNumber);
      const customerEmail = record['Customer Email']?.trim();
      
      if (orderId && customerEmail) {
        // Build billing address with customer email
        const billingFirstName = record['Billing First Name:']?.trim() || 'Unknown';
        const billingLastName = record['Billing Last Name']?.trim() || 'Customer';
        const billingStreet1 = record['Billing Street1']?.trim();
        const billingCity = record['Billing City']?.trim();
        
        if ((billingStreet1 || billingCity) && !existingBillingOrderIds.has(orderId)) {
          billingAddresses.push({
            order_id: orderId,
            first_name: billingFirstName,
            last_name: billingLastName,
            email: customerEmail, // Use customer email
            street1: billingStreet1 || 'Unknown Street',
            city: billingCity || 'Unknown City',
            region: record['Billing Region']?.trim() || 'Unknown',
            postcode: record['Billing PostCode']?.trim() || '00000',
            country: record['Billing Country']?.trim() || 'Unknown',
            phone: record['Billing Tel']?.trim() || null,
            created_at: new Date().toISOString()
          });
        }

        // Build shipping address with customer email
        const shippingFirstName = record['Shipping First Name:']?.trim() || 'Unknown';
        const shippingLastName = record['Shipping Last Name']?.trim() || 'Customer';
        const shippingStreet1 = record['Shipping Street1']?.trim();
        const shippingCity = record['Shipping City']?.trim();
        
        if ((shippingStreet1 || shippingCity) && !existingShippingOrderIds.has(orderId)) {
          shippingAddresses.push({
            order_id: orderId,
            first_name: shippingFirstName,
            last_name: shippingLastName,
            email: customerEmail, // Use customer email
            street1: shippingStreet1 || 'Unknown Street',
            city: shippingCity || 'Unknown City',
            region: record['Shipping Region']?.trim() || 'Unknown',
            postcode: record['Shipping PostCode']?.trim() || '00000',
            country: record['Shipping Country']?.trim() || 'Unknown',
            phone: record['Shipping Tel']?.trim() || null,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    console.log(`📊 Found ${billingAddresses.length} new billing addresses to import`);
    console.log(`📊 Found ${shippingAddresses.length} new shipping addresses to import`);

    // Import billing addresses
    if (billingAddresses.length > 0) {
      const addressBatchSize = 1000;
      let billingCreated = 0;
      
      for (let i = 0; i < billingAddresses.length; i += addressBatchSize) {
        const batch = billingAddresses.slice(i, i + addressBatchSize);
        
        const { error } = await supabase
          .from("order_billing_address")
          .insert(batch);

        if (error) {
          console.error("❌ Error inserting billing addresses batch:", error.message);
        } else {
          billingCreated += batch.length;
          console.log(`✅ Inserted ${batch.length} billing addresses`);
        }
      }
      
      console.log(`✅ Created ${billingCreated} billing addresses`);
    }

    // Import shipping addresses
    if (shippingAddresses.length > 0) {
      const addressBatchSize = 1000;
      let shippingCreated = 0;
      
      for (let i = 0; i < shippingAddresses.length; i += addressBatchSize) {
        const batch = shippingAddresses.slice(i, i + addressBatchSize);
        
        const { error } = await supabase
          .from("order_shipping_address")
          .insert(batch);

        if (error) {
          console.error("❌ Error inserting shipping addresses batch:", error.message);
        } else {
          shippingCreated += batch.length;
          console.log(`✅ Inserted ${batch.length} shipping addresses`);
        }
      }
      
      console.log(`✅ Created ${shippingCreated} shipping addresses`);
    }

    // Step 6: Import 3D related data
    console.log("\n🎨 STEP 6: Importing 3D related data...");
    const threeDCsvPath = path.join(MIGRATION_DIR, "3drelated.csv");
    if (fs.existsSync(threeDCsvPath)) {
      const threeDFileContent = fs.readFileSync(threeDCsvPath, "utf8");
      const threeDRecords = parse(threeDFileContent, {
        columns: true,
        skip_empty_lines: true,
      });

      const threeDItems = [];
      
      for (const record of threeDRecords) {
        const orderNumber = record["Order #"]?.toString();
        const orderId = orderIdMap.get(orderNumber);

        if (orderId) {
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
                date_added: record["Date"] || new Date().toISOString(),
                added_by: null,
                comments: null,
                created_at: new Date().toISOString()
              });
            }
          }
        }
      }

      console.log(`📊 Found ${threeDItems.length} 3D items to import`);

      if (threeDItems.length > 0) {
        const threeDBatchSize = 1000;
        let threeDCreated = 0;
        
        for (let i = 0; i < threeDItems.length; i += threeDBatchSize) {
          const batch = threeDItems.slice(i, i + threeDBatchSize);
          
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

    // Step 7: Final status check
    console.log("\n" + "=".repeat(70));
    console.log("🔄 DATA RESTORATION COMPLETED");
    
    // Get final counts
    const { count: finalCustomerCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
    const { count: finalOrderCount } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const { count: finalOrderItemCount } = await supabase.from('order_items').select('*', { count: 'exact', head: true });
    const { count: finalBillingCount } = await supabase.from('order_billing_address').select('*', { count: 'exact', head: true });
    const { count: finalShippingCount } = await supabase.from('order_shipping_address').select('*', { count: 'exact', head: true });
    const { count: finalThreeDCount } = await supabase.from('order_3d_related').select('*', { count: 'exact', head: true });
    
    console.log(`📊 RESTORED DATABASE COUNTS:`);
    console.log(`  - Customers: ${finalCustomerCount}`);
    console.log(`  - Orders: ${finalOrderCount}`);
    console.log(`  - Order Items: ${finalOrderItemCount}`);
    console.log(`  - Billing Addresses: ${finalBillingCount}`);
    console.log(`  - Shipping Addresses: ${finalShippingCount}`);
    console.log(`  - 3D Related: ${finalThreeDCount}`);

    console.log("\n✅ Data restoration completed successfully!");
    console.log("📊 All data has been restored from CSV files");

  } catch (error) {
    console.error("❌ Error during data restoration:", error);
  }
}

restoreFromCSV();
