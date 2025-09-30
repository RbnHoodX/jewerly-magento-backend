// ULTRA-FAST Script to import complete order data from split CSV/Excel files to Supabase
// This version is optimized for MAXIMUM speed using all available techniques

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../src/utils/logger";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import { cpus } from "os";

const logger = new Logger("ImportOrdersUltraFast");

// Initialize Supabase client with optimized settings
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

// Interfaces for the split file data
interface MainOrderData {
  "Order #": number;
  "Customization Notes": string;
  "Order Date": string;
  "Customer Id": number;
  "Customer Email": string;
  "Billing First Name:": string;
  "Billing Last Name": string;
  "Billing Street1": string;
  "Billing City": string;
  "Billing Region": string;
  "Billing PostCode": string;
  "Billing Country": string;
  "Billing Tel": string;
  "Shipping First Name:": string;
  "Shipping Last Name": string;
  "Shipping Street1": string;
  "Shipping City": string;
  "Shipping Region": string;
  "Shipping PostCode": string;
  "Shipping Country": string;
  "Shipping Tel": string;
  // Product columns (up to 10 products)
  "Product Image 1": string;
  "SKU 1": string;
  "Stock Number 1": string;
  "product Information 1": string;
  "Price 1": string;
  "Qty 1": number;
  "Row Subtotal 1": string;
  "Comment 1": string;
  // ... (up to Product 10)
}

interface CustomerNoteData {
  "Order #": string;
  "Date Added": string;
  "Order Status": string;
  Employee: string;
  Comment: string;
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
  MM: string;
  Comments: string;
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
  "Attachment 2": string;
  // ... (up to Attachment 49)
}

interface EmployeeCommentData {
  "Order #": string;
  "Employee Names": string;
  "Date Added": string;
  Comment: string;
  "File Attachment 1": string;
}

class UltraFastOrderImporter {
  private processedOrders = new Set<number>();
  private migrationDir = path.join(__dirname, "../migration");
  private BATCH_SIZE = 500; // Smaller batch size to avoid database constraints
  private MAX_CONCURRENT = 4; // Reduced concurrent operations to avoid database overload
  private MAX_RETRIES = 3;

  async importAllData() {
    const startTime = Date.now();
    try {
      logger.info("Starting ULTRA-FAST order import from split files...");
      logger.info("Migration directory: " + this.migrationDir);
      logger.info("Using " + this.MAX_CONCURRENT + " concurrent operations");

      // Check if migration directory exists
      if (!fs.existsSync(this.migrationDir)) {
        throw new Error("Migration directory not found: " + this.migrationDir);
      }

      // Import main orders first (required for all other data)
      await this.importMainOrdersUltraFast();

      // Then import related data in parallel (depends on main orders existing)
      const relatedDataPromises = [
        this.importCustomerNotesUltraFast(),
        this.importDiamondsUltraFast(),
        this.importCastingUltraFast(),
        this.importThreeDUltraFast(),
        this.importEmployeeCommentsUltraFast(),
      ];

      await Promise.all(relatedDataPromises);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      logger.info(
        "Complete import finished successfully in " +
          duration.toFixed(2) +
          " seconds!"
      );
      logger.info(
        "Average speed: " +
          (this.getTotalRecords() / duration).toFixed(0) +
          " records/second"
      );
    } catch (error) {
      logger.error("Import failed:", error);
      throw error;
    }
  }

  private getTotalRecords(): number {
    // Estimate total records for speed calculation
    return 100000; // This would be calculated from actual file sizes
  }

  private async importMainOrdersUltraFast() {
    const startTime = Date.now();
    logger.info("===== MAIN ORDERS IMPORT (ULTRA-FAST) =====");
    logger.info("Starting main orders import from main_page.csv...");

    const filePath = path.join(this.migrationDir, "main_page.csv");
    if (!fs.existsSync(filePath)) {
      logger.error(
        "MAIN ORDERS IMPORT FAILED: main_page.csv not found at " + filePath
      );
      return;
    }

    // Use streaming CSV parsing for large files
    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSVUltraFast(csvContent) as MainOrderData[];

    logger.info(
      "MAIN ORDERS DATA FOUND: " + jsonData.length + " orders in CSV"
    );

    if (jsonData.length === 0) {
      logger.warn("MAIN ORDERS IMPORT WARNING: No orders found in CSV file");
      return;
    }

    // Ultra-fast batch processing with parallel operations
    await this.batchProcessMainOrdersUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== MAIN ORDERS IMPORT COMPLETE in " + duration.toFixed(2) + "s ====="
    );
  }

  private async importCustomerNotesUltraFast() {
    const startTime = Date.now();
    logger.info("===== CUSTOMER NOTES IMPORT (ULTRA-FAST) =====");
    logger.info("Starting customer notes import from Customer Notes.csv...");

    const filePath = path.join(this.migrationDir, "Customer Notes.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("Customer Notes.csv file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSVUltraFast(csvContent) as CustomerNoteData[];

    logger.info(
      "CUSTOMER NOTES DATA FOUND: " + jsonData.length + " notes in CSV"
    );

    if (jsonData.length === 0) {
      logger.warn("CUSTOMER NOTES IMPORT WARNING: No notes found in CSV file");
      return;
    }

    // Ultra-fast batch processing
    await this.batchProcessCustomerNotesUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== CUSTOMER NOTES IMPORT COMPLETE in " +
        duration.toFixed(2) +
        "s ====="
    );
  }

  private async importDiamondsUltraFast() {
    const startTime = Date.now();
    logger.info("===== DIAMONDS IMPORT (ULTRA-FAST) =====");
    logger.info("Starting diamonds import from Diamonds.csv...");

    const filePath = path.join(this.migrationDir, "Diamonds.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("Diamonds.csv file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSVUltraFast(csvContent) as DiamondData[];

    logger.info(
      "DIAMONDS DATA FOUND: " + jsonData.length + " diamond records in CSV"
    );

    if (jsonData.length === 0) {
      logger.warn(
        "DIAMONDS IMPORT WARNING: No diamond records found in CSV file"
      );
      return;
    }

    // Ultra-fast batch processing
    await this.batchProcessDiamondsUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== DIAMONDS IMPORT COMPLETE in " + duration.toFixed(2) + "s ====="
    );
  }

  private async importCastingUltraFast() {
    const startTime = Date.now();
    logger.info("===== CASTING IMPORT (ULTRA-FAST) =====");
    logger.info("Starting casting import from casting.csv...");

    const filePath = path.join(this.migrationDir, "casting.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("casting.csv file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSVUltraFast(csvContent) as CastingData[];

    logger.info(
      "CASTING DATA FOUND: " + jsonData.length + " casting records in CSV"
    );

    if (jsonData.length === 0) {
      logger.warn(
        "CASTING IMPORT WARNING: No casting records found in CSV file"
      );
      return;
    }

    // Ultra-fast batch processing
    await this.batchProcessCastingUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== CASTING IMPORT COMPLETE in " + duration.toFixed(2) + "s ====="
    );
  }

  private async importThreeDUltraFast() {
    const startTime = Date.now();
    logger.info("===== 3D RELATED IMPORT (ULTRA-FAST) =====");
    logger.info("Starting 3D related import from 3drelated.csv...");

    const filePath = path.join(this.migrationDir, "3drelated.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("3drelated.csv file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSVUltraFast(csvContent) as ThreeDData[];

    logger.info(
      "3D RELATED DATA FOUND: " + jsonData.length + " 3D records in CSV"
    );

    if (jsonData.length === 0) {
      logger.warn("3D RELATED IMPORT WARNING: No 3D records found in CSV file");
      return;
    }

    // Ultra-fast batch processing
    await this.batchProcessThreeDUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== 3D RELATED IMPORT COMPLETE in " + duration.toFixed(2) + "s ====="
    );
  }

  private async importEmployeeCommentsUltraFast() {
    const startTime = Date.now();
    logger.info("===== EMPLOYEE COMMENTS IMPORT (ULTRA-FAST) =====");
    logger.info(
      "Starting employee comments import from Employee Comments.xlsx..."
    );

    const filePath = path.join(this.migrationDir, "Employee Comments.xlsx");
    if (!fs.existsSync(filePath)) {
      logger.warn("Employee Comments.xlsx file not found");
      return;
    }

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // First sheet
    const jsonData = XLSX.utils.sheet_to_json<EmployeeCommentData>(worksheet);

    logger.info(
      "EMPLOYEE COMMENTS DATA FOUND: " + jsonData.length + " comments in Excel"
    );

    if (jsonData.length === 0) {
      logger.warn(
        "EMPLOYEE COMMENTS IMPORT WARNING: No comments found in Excel file"
      );
      return;
    }

    // Ultra-fast batch processing
    await this.batchProcessEmployeeCommentsUltraFast(jsonData);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    logger.info(
      "===== EMPLOYEE COMMENTS IMPORT COMPLETE in " +
        duration.toFixed(2) +
        "s ====="
    );
  }

  // ULTRA-FAST CSV parsing using csv-parse library with optimized settings
  private parseCSVUltraFast(csvContent: string): any[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        quote: '"',
        escape: '"',
        delimiter: ",",
        relax_column_count: true,
        trim: true,
        cast: true,
        skip_records_with_error: true,
      });
      return records;
    } catch (error) {
      logger.error("CSV parsing failed:", error);
      return [];
    }
  }

  // ULTRA-FAST batch processing methods with maximum optimization
  private async batchProcessMainOrdersUltraFast(ordersData: MainOrderData[]) {
    logger.info(
      "ULTRA-FAST batch processing " + ordersData.length + " main orders..."
    );

    // Step 1: Ultra-fast customer processing with parallel operations
    const customerMap = await this.batchUpsertCustomersUltraFast(ordersData);

    // Step 2: Ultra-fast order creation with parallel operations
    const orderMap = await this.batchCreateOrdersUltraFast(
      ordersData,
      customerMap
    );

    // Step 3: Ultra-fast parallel processing of addresses and items
    await Promise.all([
      this.batchCreateBillingAddressesUltraFast(ordersData, orderMap),
      this.batchCreateShippingAddressesUltraFast(ordersData, orderMap),
      this.batchCreateOrderItemsUltraFast(ordersData, orderMap),
    ]);

    // Mark all orders as processed
    ordersData.forEach((order) => {
      this.processedOrders.add(order["Order #"]);
    });

    logger.info("Successfully processed " + ordersData.length + " main orders");
  }

  private async batchUpsertCustomersUltraFast(
    ordersData: MainOrderData[]
  ): Promise<Map<number, string>> {
    logger.info("ULTRA-FAST batch upserting customers...");

    const customerMap = new Map<number, string>();
    const uniqueCustomers = new Map<number, MainOrderData>();

    // Collect unique customers
    ordersData.forEach((order) => {
      if (!uniqueCustomers.has(order["Customer Id"])) {
        uniqueCustomers.set(order["Customer Id"], order);
      }
    });

    logger.info(
      "Found " + uniqueCustomers.size + " unique customers to process"
    );

    // Prepare all customer data
    const customerInserts: any[] = [];
    const customerEmails: string[] = [];

    for (const [customerId, orderData] of uniqueCustomers) {
      const customerData = {
        email: orderData["Customer Email"] || "",
        name: `${orderData["Billing First Name:"]} ${orderData["Billing Last Name"]}`.trim(),
        first_name: orderData["Billing First Name:"],
        last_name: orderData["Billing Last Name"],
        phone: orderData["Billing Tel"],
        billing_addr: {
          first_name: orderData["Billing First Name:"],
          last_name: orderData["Billing Last Name"],
          street1: orderData["Billing Street1"],
          city: orderData["Billing City"],
          region: orderData["Billing Region"],
          postcode: orderData["Billing PostCode"],
          country: orderData["Billing Country"],
          phone: orderData["Billing Tel"],
          email: orderData["Customer Email"],
        },
        shipping_addr: {
          first_name: orderData["Shipping First Name:"],
          last_name: orderData["Shipping Last Name"],
          street1: orderData["Shipping Street1"],
          city: orderData["Shipping City"],
          region: orderData["Shipping Region"],
          postcode: orderData["Shipping PostCode"],
          country: orderData["Shipping Country"],
          phone: orderData["Shipping Tel"],
        },
      };

      customerInserts.push({ customerId, data: customerData });
      customerEmails.push(customerData.email);
    }

    // Ultra-fast batch check existing customers
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, email")
      .in("email", customerEmails);

    const existingMap = new Map();
    existingCustomers?.forEach((customer) => {
      existingMap.set(customer.email, customer.id);
    });

    // Separate new and existing customers
    const newCustomers: any[] = [];
    for (const { customerId, data } of customerInserts) {
      if (existingMap.has(data.email)) {
        customerMap.set(customerId, existingMap.get(data.email));
      } else {
        newCustomers.push({ customerId, data });
      }
    }

    // Ultra-fast batch insert new customers with retry logic and conflict handling
    if (newCustomers.length > 0) {
      const newCustomerData = newCustomers.map(({ data }) => data);

      // Process batches sequentially to avoid database overload
      const batches = this.chunkArray(newCustomerData, this.BATCH_SIZE);
      const results: any[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(
          "Processing customer batch " +
            (i + 1) +
            "/" +
            batches.length +
            " with " +
            batch.length +
            " customers"
        );

        try {
          const result = await this.retryOperation(async () => {
            // Deduplicate customers within the batch to avoid "affect row a second time" error
            const uniqueBatch = this.deduplicateCustomersByEmail(batch);

            // Use upsert to handle duplicate emails gracefully
            const { data: insertedCustomers, error } = await supabase
              .from("customers")
              .upsert(uniqueBatch, {
                onConflict: "email",
                ignoreDuplicates: false,
              })
              .select("id, email");

            if (error) {
              logger.error("Customer batch upsert error:", error);
              throw error;
            }
            return { batch: uniqueBatch, insertedCustomers };
          }, this.MAX_RETRIES);

          results.push(result);
          logger.info("Successfully processed batch " + (i + 1));
        } catch (error) {
          logger.error("Failed to process batch " + (i + 1) + ":", error);
          throw error;
        }
      }

      // Map new customer IDs
      results.forEach(({ batch, insertedCustomers }) => {
        const startIndex = newCustomers.findIndex(
          (c) => c.data.email === batch[0].email
        );
        insertedCustomers?.forEach((customer, index) => {
          customerMap.set(
            newCustomers[startIndex + index].customerId,
            customer.id
          );
        });
      });

      logger.info(
        "Successfully processed " +
          newCustomers.length +
          " customers (upserted)"
      );
    }

    logger.info("Processed " + customerMap.size + " customers total");
    return customerMap;
  }

  private async batchCreateOrdersUltraFast(
    ordersData: MainOrderData[],
    customerMap: Map<number, string>
  ): Promise<Map<string, string>> {
    logger.info("ULTRA-FAST batch creating orders...");
    logger.info("Customer map size: " + customerMap.size);

    const orderMap = new Map<string, string>();
    const orderInserts: any[] = [];

    let processedCount = 0;
    let skippedCount = 0;

    logger.info(
      "Starting order processing loop with " + ordersData.length + " orders"
    );

    for (const orderData of ordersData) {
      processedCount++;
      if (processedCount <= 5) {
        // Log first 5 orders for debugging
        logger.info(
          "Processing order " + processedCount + ": " + orderData["Order #"]
        );
      }

      const customerId = customerMap.get(orderData["Customer Id"]);
      if (!customerId) {
        skippedCount++;
        if (skippedCount <= 5) {
          // Only log first 5 to avoid spam
          logger.warn(
            "No customer found for order " + orderData["Order #"] + ", skipping"
          );
        }
        continue;
      }

      // Validate required fields
      if (!orderData["Order #"] || !customerId) {
        skippedCount++;
        if (skippedCount <= 5) {
          // Only log first 5 to avoid spam
          logger.warn(
            "Invalid order data, skipping order: " + JSON.stringify(orderData)
          );
        }
        continue;
      }

      processedCount++;

      let orderInsert;
      try {
        orderInsert = {
          shopify_order_number: orderData["Order #"].toString(),
          customer_id: customerId,
          purchase_from: "legacy_import",
          order_date: this.parseDate(orderData["Order Date"]),
          total_amount: this.calculateTotalAmount(orderData),
          customization_notes: orderData["Customization Notes"] || null,
          bill_to_name:
            `${orderData["Billing First Name:"]} ${orderData["Billing Last Name"]}`.trim(),
          ship_to_name:
            `${orderData["Shipping First Name:"]} ${orderData["Shipping Last Name"]}`.trim(),
          how_did_you_hear: null,
        };

        if (processedCount <= 5) {
          logger.info(
            "Order insert data for order " + processedCount + ":",
            JSON.stringify(orderInsert, null, 2)
          );
        }
      } catch (error) {
        logger.error(
          "Error creating order insert for order " + orderData["Order #"] + ":",
          error
        );
        continue;
      }

      orderInserts.push({
        orderNumber: orderData["Order #"],
        data: orderInsert,
      });
    }

    logger.info("Order processing summary:");
    logger.info("- Total orders in CSV: " + ordersData.length);
    logger.info("- Processed orders: " + processedCount);
    logger.info("- Skipped orders: " + skippedCount);
    logger.info("- Orders to insert: " + orderInserts.length);

    if (orderInserts.length > 0) {
      logger.info(
        "Processing " + orderInserts.length + " orders in batches..."
      );

      // Process orders sequentially to avoid database overload
      const batches = this.chunkArray(orderInserts, this.BATCH_SIZE);
      const results: any[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.info(
          "Processing order batch " +
            (i + 1) +
            "/" +
            batches.length +
            " with " +
            batch.length +
            " orders"
        );

        try {
          const result = await this.retryOperation(async () => {
            const batchData = batch.map(({ data }) => data);

            // Validate batch data
            const validOrders = batchData.filter((order) => {
              if (!order.customer_id) {
                logger.warn("Order missing customer_id:", order);
                return false;
              }
              return true;
            });

            if (validOrders.length === 0) {
              logger.warn("No valid orders in batch " + (i + 1));
              return { batch, orders: [] };
            }

            logger.info(
              "Inserting " +
                validOrders.length +
                " valid orders from batch " +
                (i + 1)
            );

            const { data: orders, error } = await supabase
              .from("orders")
              .insert(validOrders)
              .select("id, shopify_order_number");

            if (error) {
              logger.error("Order batch insert error:", error);
              throw error;
            }
            return { batch, orders };
          }, this.MAX_RETRIES);

          results.push(result);
          logger.info("Successfully processed order batch " + (i + 1));
        } catch (error) {
          logger.error("Failed to process order batch " + (i + 1) + ":", error);
          throw error;
        }
      }

      // Map order numbers to IDs
      results.forEach(({ batch, orders }) => {
        orders?.forEach((order, index) => {
          orderMap.set(String(batch[index].orderNumber), order.id);
        });
      });

      logger.info("Successfully created " + orderMap.size + " orders");
    }

    return orderMap;
  }

  private async batchCreateBillingAddressesUltraFast(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info("ULTRA-FAST batch creating billing addresses...");

    const addressInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(String(orderData["Order #"]));
      if (!orderId) continue;

      const addressInsert = {
        order_id: orderId,
        first_name: orderData["Billing First Name:"],
        last_name: orderData["Billing Last Name"],
        street1: orderData["Billing Street1"],
        city: orderData["Billing City"],
        region: orderData["Billing Region"],
        postcode: orderData["Billing PostCode"],
        country: orderData["Billing Country"],
        phone: orderData["Billing Tel"],
        email: orderData["Customer Email"],
      };

      addressInserts.push(addressInsert);
    }

    if (addressInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(addressInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase
            .from("order_billing_address")
            .insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " billing addresses");
    }
  }

  private async batchCreateShippingAddressesUltraFast(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info("ULTRA-FAST batch creating shipping addresses...");

    const addressInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(String(orderData["Order #"]));
      if (!orderId) continue;

      const addressInsert = {
        order_id: orderId,
        first_name: orderData["Shipping First Name:"],
        last_name: orderData["Shipping Last Name"],
        street1: orderData["Shipping Street1"],
        city: orderData["Shipping City"],
        region: orderData["Shipping Region"],
        postcode: orderData["Shipping PostCode"],
        country: orderData["Shipping Country"],
        phone: orderData["Shipping Tel"],
      };

      addressInserts.push(addressInsert);
    }

    if (addressInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(addressInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase
            .from("order_shipping_address")
            .insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " shipping addresses");
    }
  }

  private async batchCreateOrderItemsUltraFast(
    ordersData: MainOrderData[],
    orderMap: Map<string, string>
  ) {
    logger.info("ULTRA-FAST batch creating order items...");

    const itemInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(String(orderData["Order #"]));
      if (!orderId) continue;

      // Process up to 10 products per order
      for (let i = 1; i <= 10; i++) {
        const sku = orderData[`SKU ${i}` as keyof MainOrderData] as string;
        if (!sku || sku.trim() === "") continue;

        const productImage = orderData[`Product Image ${i}` as keyof MainOrderData] as string;
        const imageUrl = productImage && !productImage.startsWith("http") 
          ? `https://old-admin.primestyle.com/cron/custom-product/${productImage}`
          : productImage || null;

        const itemInsert = {
          order_id: orderId,
          sku: sku,
          details:
            (orderData[
              `product Information ${i}` as keyof MainOrderData
            ] as string) || "",
          price: parseFloat(
            (orderData[`Price ${i}` as keyof MainOrderData] as string) || "0"
          ),
          qty: (orderData[`Qty ${i}` as keyof MainOrderData] as number) || 1,
          image: imageUrl,
        };

        itemInserts.push(itemInsert);
      }
    }

    if (itemInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(itemInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase.from("order_items").insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " order items");
    }
  }

  // Additional ultra-fast batch processing methods for other data types
  private async batchProcessCustomerNotesUltraFast(
    notesData: CustomerNoteData[]
  ) {
    logger.info(
      "ULTRA-FAST batch processing " + notesData.length + " customer notes..."
    );

    // Get all order numbers first
    const orderNumbers = [...new Set(notesData.map((note) => note["Order #"]))];

    // Ultra-fast batch fetch all orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    const orderMap = new Map();
    orders?.forEach((order) => {
      orderMap.set(order.shopify_order_number, order.id);
    });

    const noteInserts: any[] = [];

    for (const noteData of notesData) {
      if (!orderMap.has(noteData["Order #"])) {
        logger.warn(
          "Order " + noteData["Order #"] + " not found for note, skipping"
        );
        continue;
      }

      const noteInsert = {
        order_id: orderMap.get(noteData["Order #"]),
        content: noteData["Comment"] || "",
        is_important: false,
        created_by: null, // System import
      };

      noteInserts.push(noteInsert);
    }

    if (noteInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(noteInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase.from("order_comments").insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " customer notes");
    }
  }

  private async batchProcessDiamondsUltraFast(diamondsData: DiamondData[]) {
    logger.info(
      "ULTRA-FAST batch processing " +
        diamondsData.length +
        " diamond records..."
    );

    // Note: This would need to be adapted based on your diamond inventory table structure
    logger.info(
      "Diamond processing not implemented yet - requires diamond inventory table setup"
    );
  }

  private async batchProcessCastingUltraFast(castingData: CastingData[]) {
    logger.info(
      "ULTRA-FAST batch processing " +
        castingData.length +
        " casting records..."
    );

    // Get all order numbers first
    const orderNumbers = [
      ...new Set(castingData.map((casting) => casting["Order #"])),
    ];

    // Ultra-fast batch fetch all orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    const orderMap = new Map();
    orders?.forEach((order) => {
      orderMap.set(order.shopify_order_number, order.id);
    });

    const castingInserts: any[] = [];

    for (const casting of castingData) {
      if (!orderMap.has(casting["Order #"])) {
        logger.warn(
          "Order " + casting["Order #"] + " not found for casting, skipping"
        );
        continue;
      }

      const castingInsert = {
        order_id: orderMap.get(casting["Order #"]),
        supplier: casting["Supplier"] || "",
        metal_type: casting["Metal Type"],
        quantity: casting["Qty"].toString(),
        weight: parseFloat(casting["Weight"].replace(" g.", "")),
        weight_unit: "g",
        price: parseFloat(casting["Price"] || "0"),
      };

      castingInserts.push(castingInsert);
    }

    if (castingInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(castingInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase.from("order_casting").insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " casting records");
    }
  }

  private async batchProcessThreeDUltraFast(threeDData: ThreeDData[]) {
    logger.info(
      "ULTRA-FAST batch processing " + threeDData.length + " 3D records..."
    );

    // Get all order numbers first
    const orderNumbers = [
      ...new Set(threeDData.map((threeD) => threeD["Order #"])),
    ];

    // Ultra-fast batch fetch all orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    const orderMap = new Map();
    orders?.forEach((order) => {
      orderMap.set(order.shopify_order_number, order.id);
    });

    const threeDInserts: any[] = [];

    for (const threeD of threeDData) {
      if (!orderMap.has(threeD["Order #"])) {
        logger.warn(
          "Order " + threeD["Order #"] + " not found for 3D record, skipping"
        );
        continue;
      }

      // Process up to 49 attachments
      for (let i = 1; i <= 49; i++) {
        const attachment = threeD[
          `Attachment ${i}` as keyof ThreeDData
        ] as string;
        if (!attachment || attachment.trim() === "") continue;

        const imageUrl = attachment.startsWith("http") 
          ? attachment 
          : attachment ? `https://old-admin.primestyle.com/cron/custom-product/${attachment}` : "";

        const threeDInsert = {
          order_id: orderMap.get(threeD["Order #"]),
          image_url: imageUrl,
          image_name: `attachment_${i}`,
        };

        threeDInserts.push(threeDInsert);
      }
    }

    if (threeDInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(threeDInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase
            .from("order_3d_related")
            .insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " 3D records");
    }
  }

  private async batchProcessEmployeeCommentsUltraFast(
    commentsData: EmployeeCommentData[]
  ) {
    logger.info(
      "ULTRA-FAST batch processing " +
        commentsData.length +
        " employee comments..."
    );

    // Get all order numbers first
    const orderNumbers = [
      ...new Set(commentsData.map((comment) => comment["Order #"])),
    ];

    // Ultra-fast batch fetch all orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    const orderMap = new Map();
    orders?.forEach((order) => {
      orderMap.set(order.shopify_order_number, order.id);
    });

    const commentInserts: any[] = [];

    for (const comment of commentsData) {
      if (!orderMap.has(comment["Order #"])) {
        logger.warn(
          "Order " + comment["Order #"] + " not found for comment, skipping"
        );
        continue;
      }

      const commentInsert = {
        order_id: orderMap.get(comment["Order #"]),
        content: comment["Comment"] || "",
        video_url: comment["File Attachment 1"] || null,
        created_by: null, // System import
      };

      commentInserts.push(commentInsert);
    }

    if (commentInserts.length > 0) {
      // Ultra-fast parallel processing
      const batches = this.chunkArray(commentInserts, this.BATCH_SIZE);
      const batchPromises = batches.map((batch, index) =>
        this.retryOperation(async () => {
          const { error } = await supabase
            .from("order_employee_comments")
            .insert(batch);

          if (error) throw error;
          return batch.length;
        }, this.MAX_RETRIES)
      );

      const results = await Promise.all(batchPromises);
      const totalCreated = results.reduce((sum, count) => sum + count, 0);
      logger.info("Created " + totalCreated + " employee comments");
    }
  }

  // Utility methods for ultra-fast processing
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: any[] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private deduplicateCustomersByEmail(customers: any[]): any[] {
    const seen = new Set<string>();
    return customers.filter((customer) => {
      if (seen.has(customer.email)) {
        return false;
      }
      seen.add(customer.email);
      return true;
    });
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          logger.warn(
            "Attempt " + attempt + " failed, retrying in " + delay + "ms..."
          );
        }
      }
    }

    throw lastError!;
  }

  private parseDate(dateString: string): string {
    try {
      if (!dateString || dateString.trim() === "") {
        return new Date().toISOString();
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        logger.warn("Invalid date: " + dateString);
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      logger.warn("Failed to parse date: " + dateString + ", error: " + error);
      return new Date().toISOString();
    }
  }

  private calculateTotalAmount(orderData: MainOrderData): number {
    try {
      let total = 0;
      for (let i = 1; i <= 10; i++) {
        const subtotalKey = `Row Subtotal ${i}` as keyof MainOrderData;
        const subtotal = orderData[subtotalKey];

        // Handle different data types (string, number, null, undefined)
        if (subtotal !== null && subtotal !== undefined) {
          const subtotalStr = String(subtotal).trim();
          if (subtotalStr !== "") {
            const amount = parseFloat(subtotalStr);
            if (!isNaN(amount)) {
              total += amount;
            }
          }
        }
      }
      return total;
    } catch (error) {
      logger.warn("Failed to calculate total amount: " + error);
      return 0;
    }
  }
}

// Main execution
async function main() {
  try {
    const importer = new UltraFastOrderImporter();
    await importer.importAllData();
  } catch (error) {
    logger.error("Import failed:", error);
    process.exit(1);
  }
}

// Run the import
if (require.main === module) {
  main();
}

export { UltraFastOrderImporter };
