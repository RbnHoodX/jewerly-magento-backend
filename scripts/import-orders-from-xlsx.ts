// Script to import complete order data from output.xlsx file to Supabase

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../src/utils/logger";
import * as XLSX from "xlsx";
import * as path from "path";

const logger = new Logger("ImportOrdersFromXLSX");

// Initialize Supabase client
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
});

// Interfaces for the Excel data
interface MainOrderData {
  "Order #": number;
  "Customization Notes": string;
  "Order Date": string;
  "Customer Id": number;
  "Date of Birth": string;
  "Billing First Name:": string;
  "Billing Last Name": string;
  "Billing Street1": string;
  "Billing City": string;
  "Billing Region": string;
  "Billing PostCode": string;
  "Billing Country": string;
  "Billing Tel": string;
  "How did you hear:": string;
  "Shipping First Name:": string;
  "Shipping Last Name": string;
  "Shipping Street1": string;
  "Shipping City": string;
  "Shipping Region": string;
  "Shipping PostCode": string;
  "Shipping Country": string;
  "Shipping Tel": string;
  "Product Image 1": string;
  "SKU 1": string;
  "Stock Number: 1": string;
  "product Information 1": string;
  "Price 1": string;
  "Qty 1": number;
  "Row Subtotal 1": string;
  "Comment 1": string;
  "Product Image 2": string;
  "SKU 2": string;
  "Stock Number: 2": string;
  "product Information 2": string;
  "Price 2": string;
  "Qty 2": number;
  "Row Subtotal 2": string;
  "Comment 2": string;
}

interface CustomerNoteData {
  "Order Number": string;
  "Date Added": string;
  "Order Status": string;
  Employee: string;
}

interface DiamondData {
  "Order #": string;
  "Date Added": string;
  Type: string;
  Product: string;
  "Parcel ID": string;
  "CT Weight": string;
  Stones: string;
  "Price Per CT": string;
  "Total Price": string;
}

interface CastingData {
  "Order #": number;
  Supplier: string;
  "Date Added": string;
  "Invoice Number": string;
  "Metal Type": string;
  Qty: number;
  Weight: string;
  Price: string;
}

interface ThreeDData {
  "Order #": number;
  Date: string;
  "Attachment 1": string;
}

interface EmployeeCommentData {
  "Order #": string;
  "Employee Names": string;
  "Date Added": string;
  Comment: string;
  "File Attachment 1": string;
}

class OrderImporter {
  private processedOrders = new Set<number>();

  async importAllData() {
    try {
      logger.info("Starting complete order import from output.xlsx...");

      const outputFilePath = path.join(__dirname, "../output.xlsx");
      logger.info(`Reading Excel file: ${outputFilePath}`);

      // Read the Excel file
      const workbook = XLSX.readFile(outputFilePath);
      logger.info(
        `Found ${workbook.SheetNames.length} sheets: ${workbook.SheetNames.join(
          ", "
        )}`
      );

      // Import data from each sheet
      await this.importMainOrders(workbook);
      await this.importCustomerNotes(workbook);
      await this.importDiamonds(workbook);
      await this.importCasting(workbook);
      // Temporarily disabled due to schema cache issues
      await this.importThreeD(workbook);
      await this.importEmployeeComments(workbook);

      logger.info("✅ Complete import finished successfully!");
    } catch (error) {
      logger.error("❌ Import failed:", error);
      throw error;
    }
  }

  private async importMainOrders(workbook: XLSX.WorkBook) {
    logger.info("📋 ===== MAIN ORDERS IMPORT =====");
    logger.info("📋 Starting main orders import...");

    const worksheet = workbook.Sheets["Main Order Page"];
    if (!worksheet) {
      logger.error(
        "❌ MAIN ORDERS IMPORT FAILED: 'Main Order Page' sheet not found in Excel file"
      );
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<MainOrderData>(worksheet);
    logger.info(
      `📊 MAIN ORDERS DATA FOUND: ${jsonData.length} orders in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ MAIN ORDERS IMPORT WARNING: No orders found in Excel sheet"
      );
      return;
    }

    // Log sample data for debugging
    logger.info(
      `📋 MAIN ORDERS SAMPLE: First order - #${jsonData[0]["Order #"]}, Customer: ${jsonData[0]["Customer Id"]}, Date: ${jsonData[0]["Order Date"]}`
    );

    // Batch process main orders
    await this.batchProcessMainOrders(jsonData);

    logger.info("📋 ===== MAIN ORDERS IMPORT COMPLETE =====");
  }

  private async batchProcessMainOrders(ordersData: MainOrderData[]) {
    logger.info(`🚀 Batch processing ${ordersData.length} main orders...`);

    // Step 1: Batch create/update customers
    const customerMap = await this.batchUpsertCustomers(ordersData);

    // Step 2: Batch create orders
    const orderMap = await this.batchCreateOrders(ordersData, customerMap);

    // Step 3: Batch create billing addresses
    await this.batchCreateBillingAddresses(ordersData, orderMap);

    // Step 4: Batch create shipping addresses
    await this.batchCreateShippingAddresses(ordersData, orderMap);

    // Step 5: Batch create order items
    await this.batchCreateOrderItems(ordersData, orderMap);

    // Mark all orders as processed
    ordersData.forEach((orderData) => {
      this.processedOrders.add(orderData["Order #"]);
    });

    logger.info(
      `✅ Successfully batch processed ${ordersData.length} main orders`
    );
  }

  private async batchUpsertCustomers(
    ordersData: MainOrderData[]
  ): Promise<Map<string, string>> {
    logger.info(`🚀 Batch upserting customers...`);

    // Get unique customer IDs
    const customerIds = Array.from(
      new Set(ordersData.map((order) => order["Customer Id"].toString()))
    );

    // Batch fetch existing customers
    const { data: existingCustomers, error: fetchError } = await supabase
      .from("customers")
      .select("id, customer_id")
      .in("customer_id", customerIds);

    if (fetchError) {
      logger.error("Error fetching existing customers:", fetchError);
      throw fetchError;
    }

    // Create customer lookup map
    const existingCustomerMap = new Map(
      existingCustomers?.map((c) => [c.customer_id, c.id]) || []
    );

    // Prepare new customers to create
    const newCustomers = ordersData
      .filter(
        (order) => !existingCustomerMap.has(order["Customer Id"].toString())
      )
      .map((order) => ({
        customer_id: order["Customer Id"].toString(),
        first_name: order["Billing First Name"] || "Unknown",
        last_name: order["Billing Last Name"] || "Unknown",
        email: `customer-${order["Customer Id"]}@example.com`, // Default email
        phone: order["Billing Tel"] || null,
        created_at: new Date().toISOString(),
      }));

    // Remove duplicates based on customer_id
    const uniqueNewCustomers = newCustomers.filter(
      (customer, index, self) =>
        index === self.findIndex((c) => c.customer_id === customer.customer_id)
    );

    let customerMap = new Map(existingCustomerMap);

    // Batch insert new customers if any
    if (uniqueNewCustomers.length > 0) {
      const { data: insertedCustomers, error: insertError } = await supabase
        .from("customers")
        .insert(uniqueNewCustomers)
        .select("id, customer_id");

      if (insertError) {
        logger.error("Error inserting new customers:", insertError);
        throw insertError;
      }

      // Add new customers to the map
      insertedCustomers?.forEach((customer) => {
        customerMap.set(customer.customer_id, customer.id);
      });

      logger.info(`✅ Created ${uniqueNewCustomers.length} new customers`);
    }

    logger.info(
      `✅ Customer batch processing complete - ${customerMap.size} customers available`
    );
    return customerMap;
  }

  private async batchCreateOrders(
    ordersData: MainOrderData[],
    customerMap: Map<string, string>
  ): Promise<Map<string, string>> {
    logger.info(`🚀 Batch creating orders...`);

    // Check for existing orders
    const orderNumbers = ordersData.map((order) => order["Order #"].toString());
    const { data: existingOrders, error: fetchError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (fetchError) {
      logger.error("Error fetching existing orders:", fetchError);
      throw fetchError;
    }

    const existingOrderMap = new Map(
      existingOrders?.map((o) => [o.shopify_order_number, o.id]) || []
    );

    // Prepare new orders to create
    const newOrders = ordersData
      .filter((order) => !existingOrderMap.has(order["Order #"].toString()))
      .map((order) => {
        const customerId = customerMap.get(order["Customer Id"].toString());
        if (!customerId) {
          throw new Error(`Customer not found for order ${order["Order #"]}`);
        }

        return {
          shopify_order_number: order["Order #"].toString(),
          customer_id: customerId,
          order_date: this.parseDate(order["Order Date"]),
          customization_notes: order["Customization Notes"] || null,
          how_did_you_hear: order["How did you hear:"] || null,
          created_at: new Date().toISOString(),
        };
      });

    let orderMap = new Map(existingOrderMap);

    // Batch insert new orders if any
    if (newOrders.length > 0) {
      const { data: insertedOrders, error: insertError } = await supabase
        .from("orders")
        .insert(newOrders)
        .select("id, shopify_order_number");

      if (insertError) {
        logger.error("Error inserting new orders:", insertError);
        throw insertError;
      }

      // Add new orders to the map
      insertedOrders?.forEach((order) => {
        orderMap.set(order.shopify_order_number, order.id);
      });

      logger.info(`✅ Created ${newOrders.length} new orders`);
    }

    logger.info(
      `✅ Order batch processing complete - ${orderMap.size} orders available`
    );
    return orderMap;
  }

  private async batchCreateBillingAddresses(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info(`🚀 Batch creating billing addresses...`);

    const billingAddresses = ordersData
      .map((orderData) => {
        const orderId = orderMap.get(orderData["Order #"].toString());
        if (!orderId) return null;

        return {
          order_id: orderId,
          first_name: orderData["Billing First Name"] || "Unknown",
          last_name: orderData["Billing Last Name"] || "Unknown",
          street1: orderData["Billing Street1"] || "",
          city: orderData["Billing City"] || "",
          region: orderData["Billing Region"] || "",
          postcode: orderData["Billing PostCode"] || "",
          country: orderData["Billing Country"] || "",
          phone: orderData["Billing Tel"] || null,
        };
      })
      .filter(Boolean);

    if (billingAddresses.length > 0) {
      const { error } = await supabase
        .from("order_billing_address")
        .insert(billingAddresses);

      if (error) {
        logger.error("Error batch inserting billing addresses:", error);
        throw error;
      }

      logger.info(`✅ Created ${billingAddresses.length} billing addresses`);
    }
  }

  private async batchCreateShippingAddresses(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info(`🚀 Batch creating shipping addresses...`);

    const shippingAddresses = ordersData
      .map((orderData) => {
        const orderId = orderMap.get(orderData["Order #"].toString());
        if (!orderId) return null;

        return {
          order_id: orderId,
          first_name: orderData["Shipping First Name"] || "Unknown",
          last_name: orderData["Shipping Last Name"] || "Unknown",
          street1: orderData["Shipping Street1"] || "",
          city: orderData["Shipping City"] || "",
          region: orderData["Shipping Region"] || "",
          postcode: orderData["Shipping PostCode"] || "",
          country: orderData["Shipping Country"] || "",
          phone: orderData["Shipping Tel"] || null,
        };
      })
      .filter(Boolean);

    if (shippingAddresses.length > 0) {
      const { error } = await supabase
        .from("order_shipping_address")
        .insert(shippingAddresses);

      if (error) {
        logger.error("Error batch inserting shipping addresses:", error);
        throw error;
      }

      logger.info(`✅ Created ${shippingAddresses.length} shipping addresses`);
    }
  }

  private async batchCreateOrderItems(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info(`🚀 Batch creating order items...`);

    const orderItems: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(orderData["Order #"].toString());
      if (!orderId) continue;

      // Add item 1 if it exists
      if (orderData["SKU 1"]) {
        orderItems.push({
          order_id: orderId,
          sku: orderData["SKU 1"],
          details: orderData["product Information 1"] || null,
          price: this.parsePrice(orderData["Price 1"]).toString(),
          qty: (
            parseInt(orderData["Qty 1"]?.toString() || "1") || 1
          ).toString(),
          image: orderData["Product Image 1"] || null,
        });
      }

      // Add item 2 if it exists
      if (orderData["SKU 2"]) {
        orderItems.push({
          order_id: orderId,
          sku: orderData["SKU 2"],
          details: orderData["product Information 2"] || null,
          price: this.parsePrice(orderData["Price 2"]).toString(),
          qty: (
            parseInt(orderData["Qty 2"]?.toString() || "1") || 1
          ).toString(),
          image: orderData["Product Image 2"] || null,
        });
      }
    }

    if (orderItems.length > 0) {
      const { error } = await supabase.from("order_items").insert(orderItems);

      if (error) {
        logger.error("Error batch inserting order items:", error);
        throw error;
      }

      logger.info(`✅ Created ${orderItems.length} order items`);
    }
  }

  private async importCustomerNotes(workbook: XLSX.WorkBook) {
    logger.info("📝 ===== CUSTOMER NOTES IMPORT =====");
    logger.info("📝 Starting customer notes import...");

    const worksheet = workbook.Sheets["Customer Notes"];
    if (!worksheet) {
      logger.error(
        "❌ CUSTOMER NOTES IMPORT FAILED: 'Customer Notes' sheet not found in Excel file"
      );
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<CustomerNoteData>(worksheet);
    logger.info(
      `📊 CUSTOMER NOTES DATA FOUND: ${jsonData.length} customer notes in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ CUSTOMER NOTES IMPORT WARNING: No customer notes found in Excel sheet"
      );
      return;
    }

    // Log sample data for debugging
    logger.info(
      `📋 CUSTOMER NOTES SAMPLE: First note - Order: ${jsonData[0]["Order Number"]}, Status: ${jsonData[0]["Order Status"]}, Date: ${jsonData[0]["Date Added"]}`
    );

    // Batch process customer notes
    await this.batchProcessCustomerNotes(jsonData);

    logger.info("📝 ===== CUSTOMER NOTES IMPORT COMPLETE =====");
  }

  private async batchProcessCustomerNotes(notesData: CustomerNoteData[]) {
    logger.info(`🚀 Batch processing ${notesData.length} customer notes...`);

    // Get all unique order numbers
    const orderNumbers = Array.from(
      new Set(notesData.map((note) => note["Order Number"].toString()))
    );

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error("Error fetching orders for customer notes:", ordersError);
      return;
    }

    // Create order lookup map
    const orderMap = new Map(
      orders?.map((order) => [order.shopify_order_number, order.id]) || []
    );

    // Prepare batch data
    const batchData = notesData
      .map((noteData) => {
        const orderId = orderMap.get(noteData["Order Number"].toString());
        if (!orderId) {
          logger.warn(
            `Order ${noteData["Order Number"]} not found for customer note`
          );
          return null;
        }

        return {
          order_id: orderId,
          content: noteData["Order Status"],
          created_at: this.parseDate(noteData["Date Added"]),
        };
      })
      .filter(Boolean);

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase
        .from("order_customer_notes")
        .insert(batchData);

      if (error) {
        logger.error("Error batch inserting customer notes:", error);
      } else {
        logger.info(
          `✅ Successfully batch inserted ${batchData.length} customer notes`
        );
      }
    }
  }

  private async importDiamonds(workbook: XLSX.WorkBook) {
    logger.info("💎 ===== DIAMOND DEDUCTIONS IMPORT =====");
    logger.info("💎 Starting diamond deductions import...");

    const worksheet = workbook.Sheets["Diamondse"];
    if (!worksheet) {
      logger.error(
        "❌ DIAMOND DEDUCTIONS IMPORT FAILED: 'Diamondse' sheet not found in Excel file"
      );
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<DiamondData>(worksheet);
    logger.info(
      `📊 DIAMOND DEDUCTIONS DATA FOUND: ${jsonData.length} diamond records in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ DIAMOND DEDUCTIONS IMPORT WARNING: No diamond records found in Excel sheet"
      );
      return;
    }

    // Log sample data for debugging
    logger.info(
      `📋 DIAMOND DEDUCTIONS SAMPLE: First record - Order: ${jsonData[0]["Order #"]}, Type: ${jsonData[0]["Type"]}, CT Weight: ${jsonData[0]["CT Weight"]}, Stones: ${jsonData[0]["Stones"]}`
    );

    // Batch process diamond deductions
    await this.batchProcessDiamondDeductions(jsonData);

    logger.info("💎 ===== DIAMOND DEDUCTIONS IMPORT COMPLETE =====");
  }

  private async batchProcessDiamondDeductions(diamondsData: DiamondData[]) {
    logger.info(
      `🚀 Batch processing ${diamondsData.length} diamond deductions...`
    );

    // Get all unique order numbers
    const orderNumbers = Array.from(
      new Set(diamondsData.map((diamond) => diamond["Order #"].toString()))
    );

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error(
        "Error fetching orders for diamond deductions:",
        ordersError
      );
      return;
    }

    // Create order lookup map
    const orderMap = new Map(
      orders?.map((order) => [order.shopify_order_number, order.id]) || []
    );

    // Prepare batch data
    const batchData = diamondsData
      .map((diamondData) => {
        const orderId = orderMap.get(diamondData["Order #"].toString());
        if (!orderId) {
          logger.warn(
            `Order ${diamondData["Order #"]} not found for diamond deduction`
          );
          return null;
        }

        return {
          order_id: orderId,
          type: diamondData["Type"].toLowerCase() as
            | "center"
            | "side"
            | "manual",
          deduction_type: diamondData["Type"].toLowerCase() as
            | "center"
            | "side"
            | "manual",
          product_sku: diamondData["Product"] || "Unknown Product",
          parcel_id: diamondData["Parcel ID"]
            ? diamondData["Parcel ID"].toString()
            : "Unknown Parcel",
          ct_weight: Math.abs(parseFloat(diamondData["CT Weight"])), // Convert negative to positive
          stones: diamondData["Stones"].toString(),
          price_per_ct: parseFloat(diamondData["Price Per CT"]),
          total_price: parseFloat(diamondData["Total Price"]),
          mm: null, // MM column doesn't exist in the data
          comments: `Imported from Excel - Product: ${
            diamondData["Product"] || "Unknown"
          }`,
          date_added: this.parseDate(diamondData["Date Added"]),
        };
      })
      .filter(Boolean);

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase
        .from("diamond_deductions")
        .insert(batchData);

      if (error) {
        logger.error("Error batch inserting diamond deductions:", error);
      } else {
        logger.info(
          `✅ Successfully batch inserted ${batchData.length} diamond deductions`
        );
      }
    }
  }

  private async importCasting(workbook: XLSX.WorkBook) {
    logger.info("🏭 ===== CASTING ORDERS IMPORT =====");
    logger.info("🏭 Starting casting orders import...");

    const worksheet = workbook.Sheets["Casting"];
    if (!worksheet) {
      logger.error(
        "❌ CASTING IMPORT FAILED: 'Casting' sheet not found in Excel file"
      );
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<CastingData>(worksheet);
    logger.info(
      `📊 CASTING DATA FOUND: ${jsonData.length} casting records in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ CASTING IMPORT WARNING: No casting records found in Excel sheet"
      );
      return;
    }

    // Log sample data for debugging
    logger.info(
      `📋 CASTING SAMPLE DATA: First record - Order: ${jsonData[0]["Order #"]}, Supplier: ${jsonData[0]["Supplier"]}, Metal: ${jsonData[0]["Metal Type"]}`
    );

    // Batch process casting orders
    await this.batchProcessCastingOrders(jsonData);

    logger.info("🏭 ===== CASTING ORDERS IMPORT COMPLETE =====");
  }

  private async batchProcessCastingOrders(castingData: CastingData[]) {
    logger.info(
      `🚀 CASTING BATCH PROCESSING: Starting batch processing of ${castingData.length} casting orders...`
    );

    // Get all unique order numbers
    const orderNumbers = Array.from(
      new Set(castingData.map((casting) => casting["Order #"].toString()))
    );
    logger.info(
      `📋 CASTING ORDERS: Found ${
        orderNumbers.length
      } unique order numbers: ${orderNumbers.join(", ")}`
    );

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error(
        "❌ CASTING ERROR: Failed to fetch orders from database:",
        ordersError
      );
      return;
    }

    logger.info(
      `📊 CASTING ORDERS: Found ${
        orders?.length || 0
      } matching orders in database`
    );

    // Create order lookup map
    const orderMap = new Map(
      orders?.map((order) => [order.shopify_order_number, order.id]) || []
    );

    // Prepare batch data
    const batchData = castingData
      .map((castingData) => {
        const orderId = orderMap.get(castingData["Order #"].toString());
        if (!orderId) {
          logger.warn(
            `⚠️ CASTING WARNING: Order ${castingData["Order #"]} not found in database for casting order`
          );
          return null;
        }

        return {
          order_id: orderId,
          supplier: castingData["Supplier"] || "Unknown",
          metal_type: castingData["Metal Type"] || "Unknown",
          quantity: parseInt(castingData["Qty"]?.toString() || "1") || 1,
          weight: parseFloat(castingData["Weight"]?.toString() || "0") || 0,
          price: parseFloat(castingData["Price"]?.toString() || "0") || 0,
        };
      })
      .filter(Boolean);

    logger.info(
      `📦 CASTING BATCH: Prepared ${batchData.length} casting orders for database insertion`
    );

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase.from("order_casting").insert(batchData);

      if (error) {
        logger.error(
          "❌ CASTING ERROR: Failed to insert casting orders into database:",
          error
        );
        logger.error("❌ CASTING ERROR DETAILS:", {
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
        });
      } else {
        logger.info(
          `✅ CASTING SUCCESS: Successfully inserted ${batchData.length} casting orders into order_casting table`
        );
        logger.info(
          `✅ CASTING COMPLETE: All casting orders processed successfully`
        );
      }
    } else {
      logger.warn(
        "⚠️ CASTING WARNING: No casting orders to insert (all orders not found in database)"
      );
    }
  }

  private async importThreeD(workbook: XLSX.WorkBook) {
    logger.info("🎨 ===== 3D FILES IMPORT =====");
    logger.info("🎨 Starting 3D files import...");

    const worksheet = workbook.Sheets["3D Related"];
    if (!worksheet) {
      logger.error(
        "❌ 3D FILES IMPORT FAILED: '3D Related' sheet not found in Excel file"
      );
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<ThreeDData>(worksheet);
    logger.info(
      `📊 3D FILES DATA FOUND: ${jsonData.length} 3D records in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ 3D FILES IMPORT WARNING: No 3D records found in Excel sheet"
      );
      return;
    }

    // Log sample data for debugging
    logger.info(
      `📋 3D FILES SAMPLE: First record - Order: ${jsonData[0]["Order #"]}, Date: ${jsonData[0]["Date"]}, Attachment: ${jsonData[0]["Attachment 1"]}`
    );

    // Try to extract hyperlinks from the worksheet
    const hyperlinks = this.extractHyperlinks(worksheet);
    logger.info(
      `🔗 3D FILES HYPERLINKS: Found ${
        Object.keys(hyperlinks).length
      } hyperlinks in 3D sheet`
    );

    // Batch process 3D records
    await this.batchProcessThreeDRecords(jsonData, hyperlinks, worksheet);

    logger.info("🎨 ===== 3D FILES IMPORT COMPLETE =====");
  }

  private async batchProcessThreeDRecords(
    threeDData: ThreeDData[],
    hyperlinks: Record<string, string>,
    worksheet: XLSX.WorkSheet
  ) {
    logger.info(`🚀 Batch processing ${threeDData.length} 3D records...`);

    // Get all unique order numbers
    const orderNumbers = Array.from(
      new Set(threeDData.map((record) => record["Order #"].toString()))
    );

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error("Error fetching orders for 3D records:", ordersError);
      return;
    }

    // Create order lookup map
    const orderMap = new Map(
      orders?.map((order) => [order.shopify_order_number, order.id]) || []
    );

    // Prepare batch data with hyperlink extraction
    const batchData = threeDData
      .map((threeDData) => {
        const orderId = orderMap.get(threeDData["Order #"].toString());
        if (!orderId) {
          logger.warn(`Order ${threeDData["Order #"]} not found for 3D record`);
          return null;
        }

        // Extract hyperlink URL
        let imageUrl = threeDData["Attachment 1"];
        if (hyperlinks && imageUrl === "view attachment") {
          const jsonData = XLSX.utils.sheet_to_json<ThreeDData>(worksheet);
          const recordIndex = jsonData.findIndex(
            (record) => record["Order #"] === threeDData["Order #"]
          );

          if (recordIndex !== -1) {
            const cellAddress = XLSX.utils.encode_cell({
              r: recordIndex + 1,
              c: 2,
            });
            const hyperlinkUrl = hyperlinks[cellAddress];
            if (hyperlinkUrl) {
              imageUrl = hyperlinkUrl;
            }
          }
        }

        return {
          order_id: orderId,
          date_added: this.parseDate(threeDData["Date"]),
          image_url: imageUrl,
          image_name: "3d_attachment",
        };
      })
      .filter(Boolean);

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase
        .from("order_3d_related")
        .insert(batchData);

      if (error) {
        logger.error("Error batch inserting 3D records:", error);
      } else {
        logger.info(
          `✅ Successfully batch inserted ${batchData.length} 3D records`
        );
      }
    }
  }

  private extractHyperlinks(worksheet: XLSX.WorkSheet): Record<string, string> {
    const hyperlinks: Record<string, string> = {};

    if (!worksheet["!ref"]) return hyperlinks;

    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    for (let row = range.s.r; row <= range.e.r; row++) {
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];

        if (!cell) continue;

        // Look for HYPERLINK formula
        if (cell.f && cell.f.startsWith("HYPERLINK(")) {
          const formula = cell.f;
          const match = formula.match(
            /HYPERLINK\("([^"]+)"\s*,\s*"([^"]+)"\)/i
          );
          if (match) {
            const url = match[1];
            hyperlinks[cellAddress] = url;
          }
        }
      }
    }

    return hyperlinks;
  }

  private async importEmployeeComments(workbook: XLSX.WorkBook) {
    logger.info("�� Importing employee comments...");

    const worksheet = workbook.Sheets["Employee Comments"];
    if (!worksheet) {
      logger.warn("⚠️ 'Employee Comments' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<EmployeeCommentData>(worksheet);
    logger.info(`Found ${jsonData.length} employee comments to import`);

    // Extract hyperlinks for file attachments
    const hyperlinks = this.extractHyperlinks(worksheet);
    logger.info(
      `Found ${
        Object.keys(hyperlinks).length
      } hyperlinks in Employee Comments sheet`
    );

    // Batch process employee comments
    await this.batchProcessEmployeeComments(jsonData, hyperlinks, worksheet);
  }

  private async batchProcessEmployeeComments(
    commentsData: EmployeeCommentData[],
    hyperlinks: Record<string, string>,
    worksheet: XLSX.WorkSheet
  ) {
    logger.info(
      `🚀 Batch processing ${commentsData.length} employee comments...`
    );

    // Get all unique order numbers
    const orderNumbers = Array.from(
      new Set(commentsData.map((comment) => comment["Order #"].toString()))
    );

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error("Error fetching orders for employee comments:", ordersError);
      return;
    }

    // Create order lookup map
    const orderMap = new Map(
      orders?.map((order) => [order.shopify_order_number, order.id]) || []
    );

    // Prepare batch data with hyperlink extraction
    const batchData = commentsData
      .map((commentData) => {
        const orderId = orderMap.get(commentData["Order #"].toString());
        if (!orderId) {
          logger.warn(
            `Order ${commentData["Order #"]} not found for employee comment`
          );
          return null;
        }

        // Extract file attachment URL
        let fileAttachmentUrl = commentData["File Attachment 1"];
        if (hyperlinks && worksheet && fileAttachmentUrl) {
          const jsonData =
            XLSX.utils.sheet_to_json<EmployeeCommentData>(worksheet);
          const recordIndex = jsonData.findIndex(
            (record) =>
              record["Order #"] === commentData["Order #"] &&
              record["Employee Names"] === commentData["Employee Names"] &&
              record["Date Added"] === commentData["Date Added"] &&
              record["Comment"] === commentData["Comment"]
          );

          if (recordIndex !== -1) {
            const cellAddress = XLSX.utils.encode_cell({
              r: recordIndex + 1,
              c: 4,
            });
            const hyperlinkUrl = hyperlinks[cellAddress];
            if (hyperlinkUrl) {
              fileAttachmentUrl = hyperlinkUrl;
            }
          }
        }

        return {
          order_id: orderId,
          content: commentData["Comment"],
          created_at: this.parseDate(commentData["Date Added"]),
          ...(fileAttachmentUrl && { file_url: fileAttachmentUrl }),
        };
      })
      .filter(Boolean);

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase
        .from("order_employee_comments")
        .insert(batchData);

      if (error) {
        logger.error("Error batch inserting employee comments:", error);
      } else {
        logger.info(
          `✅ Successfully batch inserted ${batchData.length} employee comments`
        );
      }
    }
  }

  // Helper methods
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[$,]/g, "");
    return parseFloat(cleaned) || 0;
  }

  private parseDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString();
    try {
      return new Date(dateStr).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}

// Main execution
async function main() {
  const importer = new OrderImporter();
  await importer.importAllData();
}

main().catch(console.error);
