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
    logger.info("📋 Importing main orders...");

    const worksheet = workbook.Sheets["Main Order Page"];
    if (!worksheet) {
      logger.warn("⚠️ 'Main Order Page' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<MainOrderData>(worksheet);
    logger.info(`Found ${jsonData.length} orders to import`);

    for (const orderData of jsonData) {
      try {
        await this.processMainOrder(orderData);
        this.processedOrders.add(orderData["Order #"]);
      } catch (error) {
        logger.error(
          `❌ Failed to import order ${orderData["Order #"]}:`,
          error
        );
      }
    }
  }

  private async processMainOrder(orderData: MainOrderData) {
    const orderNumber = orderData["Order #"];
    logger.info(`Processing order ${orderNumber}...`);

    // 1. Create/Update Customer
    const customerId = await this.upsertCustomer(orderData);

    // 2. Create Order
    const orderId = await this.createOrder(orderData, customerId);

    // 3. Create Billing Address
    await this.createBillingAddress(orderData, orderId);

    // 4. Create Shipping Address
    await this.createShippingAddress(orderData, orderId);

    // 5. Create Order Items
    await this.createOrderItems(orderData, orderId);

    logger.info(`✅ Order ${orderNumber} processed successfully`);
  }

  private async upsertCustomer(orderData: MainOrderData): Promise<string> {
    const customerData = {
      customer_id: orderData["Customer Id"].toString().padStart(6, "0"),
      email: `${orderData["Billing First Name:"]}.${orderData["Billing Last Name"]}@example.com`, // You might need to adjust this
      first_name: orderData["Billing First Name:"],
      last_name: orderData["Billing Last Name"],
      phone: orderData["Billing Tel"],
      billing_addr: {
        first_name: orderData["Billing First Name:"],
        last_name: orderData["Billing Last Name"],
        address1: orderData["Billing Street1"],
        city: orderData["Billing City"],
        province: orderData["Billing Region"],
        zip: orderData["Billing PostCode"],
        country: orderData["Billing Country"],
        phone: orderData["Billing Tel"],
      },
      shipping_addr: {
        first_name: orderData["Shipping First Name:"],
        last_name: orderData["Shipping Last Name"],
        address1: orderData["Shipping Street1"],
        city: orderData["Shipping City"],
        province: orderData["Shipping Region"],
        zip: orderData["Shipping PostCode"],
        country: orderData["Shipping Country"],
        phone: orderData["Shipping Tel"],
      },
    };

    const { data, error } = await supabase
      .from("customers")
      .upsert(customerData, { onConflict: "customer_id" })
      .select()
      .single();

    if (error) {
      logger.error("Error upserting customer:", error);
      throw error;
    }

    return data.id;
  }

  private async createOrder(
    orderData: MainOrderData,
    customerId: string
  ): Promise<string> {
    const price1 = this.parsePrice(orderData["Price 1"]);
    const price2 = this.parsePrice(orderData["Price 2"]);
    const subtotal1 = this.parsePrice(orderData["Row Subtotal 1"]);
    const subtotal2 = this.parsePrice(orderData["Row Subtotal 2"]);

    const totalAmount = subtotal1 + subtotal2;

    const orderInsertData = {
      customer_id: customerId,
      purchase_from: "Shopify",
      order_date: this.parseDate(orderData["Order Date"]),
      total_amount: totalAmount,
      bill_to_name: `${orderData["Billing First Name:"]} ${orderData["Billing Last Name"]}`,
      ship_to_name: `${orderData["Shipping First Name:"]} ${orderData["Shipping Last Name"]}`,
      customization_notes: orderData["Customization Notes"],
      how_did_you_hear: orderData["How did you hear:"],
      shopify_order_number: orderData["Order #"].toString(),
    };

    // First check if order already exists
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("shopify_order_number", orderData["Order #"].toString())
      .single();

    let data;
    if (existingOrder) {
      // Update existing order
      const { data: updateData, error: updateError } = await supabase
        .from("orders")
        .update(orderInsertData)
        .eq("id", existingOrder.id)
        .select()
        .single();

      if (updateError) {
        logger.error("Error updating order:", updateError);
        throw updateError;
      }
      data = updateData;
    } else {
      // Insert new order
      const { data: insertData, error: insertError } = await supabase
        .from("orders")
        .insert(orderInsertData)
        .select()
        .single();

      if (insertError) {
        logger.error("Error creating order:", insertError);
        throw insertError;
      }
      data = insertData;
    }

    return data.id;
  }

  private async createBillingAddress(
    orderData: MainOrderData,
    orderId: string
  ) {
    const billingAddress = {
      order_id: orderId,
      first_name: orderData["Billing First Name:"],
      last_name: orderData["Billing Last Name"],
      street1: orderData["Billing Street1"],
      city: orderData["Billing City"],
      region: orderData["Billing Region"],
      postcode: orderData["Billing PostCode"],
      country: orderData["Billing Country"],
      phone: orderData["Billing Tel"],
    };

    // Check if billing address already exists
    const { data: existingBilling } = await supabase
      .from("order_billing_address")
      .select("id")
      .eq("order_id", orderId)
      .single();

    if (existingBilling) {
      // Update existing billing address
      const { error: updateError } = await supabase
        .from("order_billing_address")
        .update(billingAddress)
        .eq("id", existingBilling.id);

      if (updateError) {
        logger.error("Error updating billing address:", updateError);
        throw updateError;
      }
    } else {
      // Insert new billing address
      const { error: insertError } = await supabase
        .from("order_billing_address")
        .insert(billingAddress);

      if (insertError) {
        logger.error("Error creating billing address:", insertError);
        throw insertError;
      }
    }
  }

  private async createShippingAddress(
    orderData: MainOrderData,
    orderId: string
  ) {
    const shippingAddress = {
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

    // Check if shipping address already exists
    const { data: existingShipping } = await supabase
      .from("order_shipping_address")
      .select("id")
      .eq("order_id", orderId)
      .single();

    if (existingShipping) {
      // Update existing shipping address
      const { error: updateError } = await supabase
        .from("order_shipping_address")
        .update(shippingAddress)
        .eq("id", existingShipping.id);

      if (updateError) {
        logger.error("Error updating shipping address:", updateError);
        throw updateError;
      }
    } else {
      // Insert new shipping address
      const { error: insertError } = await supabase
        .from("order_shipping_address")
        .insert(shippingAddress);

      if (insertError) {
        logger.error("Error creating shipping address:", insertError);
        throw insertError;
      }
    }
  }

  private async createOrderItems(orderData: MainOrderData, orderId: string) {
    // Product 1
    if (orderData["SKU 1"] && orderData["SKU 1"].trim()) {
      const price1 = this.parsePrice(orderData["Price 1"]);
      const orderItem1 = {
        order_id: orderId,
        sku: orderData["SKU 1"],
        details: orderData["product Information 1"],
        price: price1,
        qty: orderData["Qty 1"] || 1,
        image: orderData["Product Image 1"],
      };

      const { error: error1 } = await supabase
        .from("order_items")
        .insert(orderItem1);

      if (error1) {
        logger.error("Error creating order item 1:", error1);
      }
    }

    // Product 2
    if (orderData["SKU 2"] && orderData["SKU 2"].trim()) {
      const price2 = this.parsePrice(orderData["Price 2"]);
      const orderItem2 = {
        order_id: orderId,
        sku: orderData["SKU 2"],
        details: orderData["product Information 2"],
        price: price2,
        qty: orderData["Qty 2"] || 1,
        image: orderData["Product Image 2"],
      };

      const { error: error2 } = await supabase
        .from("order_items")
        .insert(orderItem2);

      if (error2) {
        logger.error("Error creating order item 2:", error2);
      }
    }
  }

  private async importCustomerNotes(workbook: XLSX.WorkBook) {
    logger.info("📝 Importing customer notes...");

    const worksheet = workbook.Sheets["Customer Notes"];
    if (!worksheet) {
      logger.warn("⚠️ 'Customer Notes' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<CustomerNoteData>(worksheet);
    logger.info(`Found ${jsonData.length} customer notes to import`);

    // Batch process customer notes
    await this.batchProcessCustomerNotes(jsonData);
  }

  private async batchProcessCustomerNotes(notesData: CustomerNoteData[]) {
    logger.info(`🚀 Batch processing ${notesData.length} customer notes...`);

    // Get all unique order numbers
    const orderNumbers = [
      ...new Set(notesData.map((note) => note["Order Number"].toString())),
    ];

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
    logger.info("💎 Importing diamond deductions...");

    const worksheet = workbook.Sheets["Diamondse"];
    if (!worksheet) {
      logger.warn("⚠️ 'Diamondse' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<DiamondData>(worksheet);
    logger.info(`Found ${jsonData.length} diamond records to import`);

    // Batch process diamond deductions
    await this.batchProcessDiamondDeductions(jsonData);
  }

  private async batchProcessDiamondDeductions(diamondsData: DiamondData[]) {
    logger.info(
      `🚀 Batch processing ${diamondsData.length} diamond deductions...`
    );

    // Get all unique order numbers
    const orderNumbers = [
      ...new Set(diamondsData.map((diamond) => diamond["Order #"].toString())),
    ];

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
    logger.info("🏭 Importing casting orders...");

    const worksheet = workbook.Sheets["Casting"];
    if (!worksheet) {
      logger.warn("⚠️ 'Casting' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<CastingData>(worksheet);
    logger.info(`Found ${jsonData.length} casting records to import`);

    // Batch process casting orders
    await this.batchProcessCastingOrders(jsonData);
  }

  private async batchProcessCastingOrders(castingData: CastingData[]) {
    logger.info(`🚀 Batch processing ${castingData.length} casting orders...`);

    // Get all unique order numbers
    const orderNumbers = [
      ...new Set(castingData.map((casting) => casting["Order #"].toString())),
    ];

    // Batch fetch all orders
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .in("shopify_order_number", orderNumbers);

    if (ordersError) {
      logger.error("Error fetching orders for casting orders:", ordersError);
      return;
    }

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
            `Order ${castingData["Order #"]} not found for casting order`
          );
          return null;
        }

        return {
          order_id: orderId,
          order_number: castingData["Order #"].toString(),
          status: "completed", // Default status
        };
      })
      .filter(Boolean);

    // Batch insert
    if (batchData.length > 0) {
      const { error } = await supabase.from("casting_orders").insert(batchData);

      if (error) {
        logger.error("Error batch inserting casting orders:", error);
      } else {
        logger.info(
          `✅ Successfully batch inserted ${batchData.length} casting orders`
        );
      }
    }
  }

  private async importThreeD(workbook: XLSX.WorkBook) {
    logger.info("🎨 Importing 3D related data...");

    const worksheet = workbook.Sheets["3D Related"];
    if (!worksheet) {
      logger.warn("⚠️ '3D Related' sheet not found");
      return;
    }

    const jsonData = XLSX.utils.sheet_to_json<ThreeDData>(worksheet);
    logger.info(`Found ${jsonData.length} 3D records to import`);

    // Try to extract hyperlinks from the worksheet
    const hyperlinks = this.extractHyperlinks(worksheet);
    logger.info(
      `Found ${Object.keys(hyperlinks).length} hyperlinks in 3D sheet`
    );

    // Batch process 3D records
    await this.batchProcessThreeDRecords(jsonData, hyperlinks, worksheet);
  }

  private async batchProcessThreeDRecords(
    threeDData: ThreeDData[],
    hyperlinks: Record<string, string>,
    worksheet: XLSX.WorkSheet
  ) {
    logger.info(`🚀 Batch processing ${threeDData.length} 3D records...`);

    // Get all unique order numbers
    const orderNumbers = [
      ...new Set(threeDData.map((record) => record["Order #"].toString())),
    ];

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
    const orderNumbers = [
      ...new Set(commentsData.map((comment) => comment["Order #"].toString())),
    ];

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
