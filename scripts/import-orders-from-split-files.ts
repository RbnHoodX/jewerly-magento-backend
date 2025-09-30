// Script to import complete order data from split CSV/Excel files to Supabase
// This replaces the single Excel file approach with multiple split files

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../src/utils/logger";
import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

const logger = new Logger("ImportOrdersFromSplitFiles");

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

class SplitFileOrderImporter {
  private processedOrders = new Set<number>();
  private migrationDir = path.join(__dirname, "../migration");

  async importAllData() {
    try {
      logger.info("Starting complete order import from split files...");
      logger.info(`Migration directory: ${this.migrationDir}`);

      // Check if migration directory exists
      if (!fs.existsSync(this.migrationDir)) {
        throw new Error(`Migration directory not found: ${this.migrationDir}`);
      }

      // Import data from each file
      await this.importMainOrders();
      await this.importCustomerNotes();
      await this.importDiamonds();
      await this.importCasting();
      await this.importThreeD();
      await this.importEmployeeComments();

      logger.info("✅ Complete import finished successfully!");
    } catch (error) {
      logger.error("❌ Import failed:", error);
      throw error;
    }
  }

  private async importMainOrders() {
    logger.info("📋 ===== MAIN ORDERS IMPORT =====");
    logger.info("📋 Starting main orders import from main_page.csv...");

    const filePath = path.join(this.migrationDir, "main_page.csv");
    if (!fs.existsSync(filePath)) {
      logger.error(
        `❌ MAIN ORDERS IMPORT FAILED: main_page.csv not found at ${filePath}`
      );
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSV(csvContent) as MainOrderData[];

    logger.info(`📊 MAIN ORDERS DATA FOUND: ${jsonData.length} orders in CSV`);

    if (jsonData.length === 0) {
      logger.warn("⚠️ MAIN ORDERS IMPORT WARNING: No orders found in CSV file");
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

  private async importCustomerNotes() {
    logger.info("📝 ===== CUSTOMER NOTES IMPORT =====");
    logger.info("📝 Starting customer notes import from Customer Notes.csv...");

    const filePath = path.join(this.migrationDir, "Customer Notes.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("⚠️ 'Customer Notes.csv' file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSV(csvContent) as CustomerNoteData[];

    logger.info(
      `📊 CUSTOMER NOTES DATA FOUND: ${jsonData.length} notes in CSV`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ CUSTOMER NOTES IMPORT WARNING: No notes found in CSV file"
      );
      return;
    }

    // Batch process customer notes
    await this.batchProcessCustomerNotes(jsonData);

    logger.info("📝 ===== CUSTOMER NOTES IMPORT COMPLETE =====");
  }

  private async importDiamonds() {
    logger.info("💎 ===== DIAMONDS IMPORT =====");
    logger.info("💎 Starting diamonds import from Diamonds.csv...");

    const filePath = path.join(this.migrationDir, "Diamonds.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("⚠️ 'Diamonds.csv' file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSV(csvContent) as DiamondData[];

    logger.info(
      `📊 DIAMONDS DATA FOUND: ${jsonData.length} diamond records in CSV`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ DIAMONDS IMPORT WARNING: No diamond records found in CSV file"
      );
      return;
    }

    // Batch process diamonds
    await this.batchProcessDiamonds(jsonData);

    logger.info("💎 ===== DIAMONDS IMPORT COMPLETE =====");
  }

  private async importCasting() {
    logger.info("🏭 ===== CASTING IMPORT =====");
    logger.info("🏭 Starting casting import from casting.csv...");

    const filePath = path.join(this.migrationDir, "casting.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("⚠️ 'casting.csv' file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSV(csvContent) as CastingData[];

    logger.info(
      `📊 CASTING DATA FOUND: ${jsonData.length} casting records in CSV`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ CASTING IMPORT WARNING: No casting records found in CSV file"
      );
      return;
    }

    // Batch process casting
    await this.batchProcessCasting(jsonData);

    logger.info("🏭 ===== CASTING IMPORT COMPLETE =====");
  }

  private async importThreeD() {
    logger.info("🎨 ===== 3D RELATED IMPORT =====");
    logger.info("🎨 Starting 3D related import from 3drelated.csv...");

    const filePath = path.join(this.migrationDir, "3drelated.csv");
    if (!fs.existsSync(filePath)) {
      logger.warn("⚠️ '3drelated.csv' file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const jsonData = this.parseCSV(csvContent) as ThreeDData[];

    logger.info(
      `📊 3D RELATED DATA FOUND: ${jsonData.length} 3D records in CSV`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ 3D RELATED IMPORT WARNING: No 3D records found in CSV file"
      );
      return;
    }

    // Batch process 3D related
    await this.batchProcessThreeD(jsonData);

    logger.info("🎨 ===== 3D RELATED IMPORT COMPLETE =====");
  }

  private async importEmployeeComments() {
    logger.info("💬 ===== EMPLOYEE COMMENTS IMPORT =====");
    logger.info(
      "💬 Starting employee comments import from Employee Comments.xlsx..."
    );

    const filePath = path.join(this.migrationDir, "Employee Comments.xlsx");
    if (!fs.existsSync(filePath)) {
      logger.warn("⚠️ 'Employee Comments.xlsx' file not found");
      return;
    }

    // Read Excel file
    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]; // First sheet
    const jsonData = XLSX.utils.sheet_to_json<EmployeeCommentData>(worksheet);

    logger.info(
      `📊 EMPLOYEE COMMENTS DATA FOUND: ${jsonData.length} comments in Excel`
    );

    if (jsonData.length === 0) {
      logger.warn(
        "⚠️ EMPLOYEE COMMENTS IMPORT WARNING: No comments found in Excel file"
      );
      return;
    }

    // Batch process employee comments
    await this.batchProcessEmployeeComments(jsonData);

    logger.info("💬 ===== EMPLOYEE COMMENTS IMPORT COMPLETE =====");
  }

  // CSV parsing utility
  private parseCSV(csvContent: string): any[] {
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    const result: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i]
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });
        result.push(row);
      }
    }

    return result;
  }

  // Batch processing methods (similar to original script but adapted for new structure)
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
    ordersData.forEach((order) => {
      this.processedOrders.add(order["Order #"]);
    });

    logger.info(`✅ Successfully processed ${ordersData.length} main orders`);
  }

  private async batchUpsertCustomers(
    ordersData: MainOrderData[]
  ): Promise<Map<number, string>> {
    logger.info("👥 Batch upserting customers...");

    const customerMap = new Map<number, string>();
    const uniqueCustomers = new Map<number, MainOrderData>();

    // Collect unique customers
    ordersData.forEach((order) => {
      if (!uniqueCustomers.has(order["Customer Id"])) {
        uniqueCustomers.set(order["Customer Id"], order);
      }
    });

    logger.info(`Found ${uniqueCustomers.size} unique customers to process`);

    // Process each unique customer
    for (const [customerId, orderData] of uniqueCustomers) {
      try {
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

        // Check if customer exists
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("email", customerData.email)
          .maybeSingle();

        if (existing?.id) {
          customerMap.set(customerId, existing.id);
          logger.info(
            `✅ Customer ${customerId} already exists: ${existing.id}`
          );
        } else {
          // Create new customer
          const { data: newCustomer, error } = await supabase
            .from("customers")
            .insert(customerData)
            .select("id")
            .single();

          if (error) {
            logger.error(`❌ Failed to create customer ${customerId}:`, error);
            continue;
          }

          customerMap.set(customerId, newCustomer.id);
          logger.info(
            `✅ Created new customer ${customerId}: ${newCustomer.id}`
          );
        }
      } catch (error) {
        logger.error(`❌ Error processing customer ${customerId}:`, error);
      }
    }

    return customerMap;
  }

  private async batchCreateOrders(
    ordersData: MainOrderData[],
    customerMap: Map<number, string>
  ): Promise<Map<number, string>> {
    logger.info("📦 Batch creating orders...");

    const orderMap = new Map<number, string>();
    const orderInserts: any[] = [];

    for (const orderData of ordersData) {
      const customerId = customerMap.get(orderData["Customer Id"]);
      if (!customerId) {
        logger.warn(
          `⚠️ No customer found for order ${orderData["Order #"]}, skipping`
        );
        continue;
      }

      const orderInsert = {
        shopify_order_number: orderData["Order #"].toString(),
        customer_id: customerId,
        purchase_from: "legacy_import",
        order_date: this.parseDate(orderData["Order Date"]),
        current_status: "imported",
        total_amount: this.calculateTotalAmount(orderData),
        customization_notes: orderData["Customization Notes"] || null,
        bill_to_name:
          `${orderData["Billing First Name:"]} ${orderData["Billing Last Name"]}`.trim(),
        ship_to_name:
          `${orderData["Shipping First Name:"]} ${orderData["Shipping Last Name"]}`.trim(),
        how_did_you_hear: null,
      };

      orderInserts.push(orderInsert);
    }

    if (orderInserts.length > 0) {
      const { data: orders, error } = await supabase
        .from("orders")
        .insert(orderInserts)
        .select("id");

      if (error) {
        logger.error("❌ Failed to create orders:", error);
        throw error;
      }

      // Map order numbers to IDs
      orders.forEach((order, index) => {
        orderMap.set(ordersData[index]["Order #"], order.id);
      });

      logger.info(`✅ Successfully created ${orders.length} orders`);
    }

    return orderMap;
  }

  private async batchCreateBillingAddresses(
    ordersData: MainOrderData[],
    orderMap: Map<number, string>
  ) {
    logger.info("🏠 Batch creating billing addresses...");

    const addressInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(orderData["Order #"]);
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
      const { error } = await supabase
        .from("order_billing_address")
        .insert(addressInserts);

      if (error) {
        logger.error("❌ Failed to create billing addresses:", error);
      } else {
        logger.info(
          `✅ Successfully created ${addressInserts.length} billing addresses`
        );
      }
    }
  }

  private async batchCreateShippingAddresses(
    ordersData: MainOrderData[],
    orderMap: Map<number, string>
  ) {
    logger.info("🚚 Batch creating shipping addresses...");

    const addressInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(orderData["Order #"]);
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
      const { error } = await supabase
        .from("order_shipping_address")
        .insert(addressInserts);

      if (error) {
        logger.error("❌ Failed to create shipping addresses:", error);
      } else {
        logger.info(
          `✅ Successfully created ${addressInserts.length} shipping addresses`
        );
      }
    }
  }

  private async batchCreateOrderItems(
    ordersData: MainOrderData[],
    orderMap: Map<number, string>
  ) {
    logger.info("📦 Batch creating order items...");

    const itemInserts: any[] = [];

    for (const orderData of ordersData) {
      const orderId = orderMap.get(orderData["Order #"]);
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
      const { error } = await supabase.from("order_items").insert(itemInserts);

      if (error) {
        logger.error("❌ Failed to create order items:", error);
      } else {
        logger.info(
          `✅ Successfully created ${itemInserts.length} order items`
        );
      }
    }
  }

  // Additional batch processing methods for other data types
  private async batchProcessCustomerNotes(notesData: CustomerNoteData[]) {
    logger.info(`📝 Batch processing ${notesData.length} customer notes...`);

    const noteInserts: any[] = [];

    for (const noteData of notesData) {
      // Find the order ID for this order number
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("id", noteData["Order #"])
        .single();

      if (!order) {
        logger.warn(
          `⚠️ Order ${noteData["Order #"]} not found for note, skipping`
        );
        continue;
      }

      const noteInsert = {
        order_id: order.id,
        content: noteData["Comment"] || "",
        is_important: false,
        created_by: null, // System import
      };

      noteInserts.push(noteInsert);
    }

    if (noteInserts.length > 0) {
      const { error } = await supabase
        .from("order_comments")
        .insert(noteInserts);

      if (error) {
        logger.error("❌ Failed to create customer notes:", error);
      } else {
        logger.info(
          `✅ Successfully created ${noteInserts.length} customer notes`
        );
      }
    }
  }

  private async batchProcessDiamonds(diamondsData: DiamondData[]) {
    logger.info(
      `💎 Batch processing ${diamondsData.length} diamond records...`
    );

    // Note: This would need to be adapted based on your diamond inventory table structure
    logger.info(
      "💎 Diamond processing not implemented yet - requires diamond inventory table setup"
    );
  }

  private async batchProcessCasting(castingData: CastingData[]) {
    logger.info(`🏭 Batch processing ${castingData.length} casting records...`);

    const castingInserts: any[] = [];

    for (const casting of castingData) {
      // Find the order ID for this order number
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("id", casting["Order #"])
        .single();

      if (!order) {
        logger.warn(
          `⚠️ Order ${casting["Order #"]} not found for casting, skipping`
        );
        continue;
      }

      const castingInsert = {
        order_id: order.id,
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
      const { error } = await supabase
        .from("order_casting")
        .insert(castingInserts);

      if (error) {
        logger.error("❌ Failed to create casting records:", error);
      } else {
        logger.info(
          `✅ Successfully created ${castingInserts.length} casting records`
        );
      }
    }
  }

  private async batchProcessThreeD(threeDData: ThreeDData[]) {
    logger.info(`🎨 Batch processing ${threeDData.length} 3D records...`);

    const threeDInserts: any[] = [];

    for (const threeD of threeDData) {
      // Find the order ID for this order number
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("id", threeD["Order #"])
        .single();

      if (!order) {
        logger.warn(
          `⚠️ Order ${threeD["Order #"]} not found for 3D record, skipping`
        );
        continue;
      }

      // Process up to 49 attachments
      for (let i = 1; i <= 49; i++) {
        const attachment = threeD[
          `Attachment ${i}` as keyof ThreeDData
        ] as string;
        if (!attachment || attachment.trim() === "") continue;

        const threeDInsert = {
          order_id: order.id,
          image_url: attachment,
          image_name: `attachment_${i}`,
        };

        threeDInserts.push(threeDInsert);
      }
    }

    if (threeDInserts.length > 0) {
      const { error } = await supabase
        .from("order_3d_related")
        .insert(threeDInserts);

      if (error) {
        logger.error("❌ Failed to create 3D records:", error);
      } else {
        logger.info(
          `✅ Successfully created ${threeDInserts.length} 3D records`
        );
      }
    }
  }

  private async batchProcessEmployeeComments(
    commentsData: EmployeeCommentData[]
  ) {
    logger.info(
      `💬 Batch processing ${commentsData.length} employee comments...`
    );

    const commentInserts: any[] = [];

    for (const comment of commentsData) {
      // Find the order ID for this order number
      const { data: order } = await supabase
        .from("orders")
        .select("id")
        .eq("id", comment["Order #"])
        .single();

      if (!order) {
        logger.warn(
          `⚠️ Order ${comment["Order #"]} not found for comment, skipping`
        );
        continue;
      }

      const commentInsert = {
        order_id: order.id,
        content: comment["Comment"] || "",
        video_url: comment["File Attachment 1"] || null,
        created_by: null, // System import
      };

      commentInserts.push(commentInsert);
    }

    if (commentInserts.length > 0) {
      const { error } = await supabase
        .from("order_employee_comments")
        .insert(commentInserts);

      if (error) {
        logger.error("❌ Failed to create employee comments:", error);
      } else {
        logger.info(
          `✅ Successfully created ${commentInserts.length} employee comments`
        );
      }
    }
  }

  // Utility methods
  private parseDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString();
    } catch (error) {
      logger.warn(`⚠️ Failed to parse date: ${dateString}`);
      return new Date().toISOString();
    }
  }

  private calculateTotalAmount(orderData: MainOrderData): number {
    let total = 0;
    for (let i = 1; i <= 10; i++) {
      const subtotal = orderData[
        `Row Subtotal ${i}` as keyof MainOrderData
      ] as string;
      if (subtotal && subtotal.trim() !== "") {
        total += parseFloat(subtotal) || 0;
      }
    }
    return total;
  }
}

// Main execution
async function main() {
  try {
    const importer = new SplitFileOrderImporter();
    await importer.importAllData();
  } catch (error) {
    logger.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run the import
if (require.main === module) {
  main();
}

export { SplitFileOrderImporter };
