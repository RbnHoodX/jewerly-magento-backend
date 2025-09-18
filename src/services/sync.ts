// Sync service for order synchronization

import { Logger } from "../utils/logger";
import { ShopifyService } from "./shopify";
import { createClient } from "@supabase/supabase-js";
import {
  ShopifyOrder,
  CustomerUpsertData,
  OrderInsertData,
  OrderItemInsertData,
  AddressInsertData,
} from "../types";
import { DatabaseService } from "./database";
import { SystemSettingsService } from "./systemSettings";

export class SyncService {
  private logger = new Logger("SyncService");
  private shopifyService: ShopifyService;
  private supabase: any;
  private databaseService: DatabaseService;

  constructor() {
    // Initialize Shopify service
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const apiVersion = process.env.SHOPIFY_API_VERSION;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    this.logger.log("info", "Shopify configuration", {
      storeDomain: storeDomain ? "✓" : "✗",
      apiVersion: apiVersion ? "✓" : "✗",
      accessToken: accessToken ? "✓" : "✗",
    });

    if (!storeDomain || !apiVersion || !accessToken) {
      throw new Error("Shopify configuration missing");
    }

    this.shopifyService = new ShopifyService(
      storeDomain,
      apiVersion,
      accessToken
    );

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.databaseService = new DatabaseService(this.supabase);
  }

  /**
   * Sync orders from Shopify to database
   */
  async syncOrders(): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log("info", "Starting order sync");

      // Fetch orders from Shopify
      let orders: ShopifyOrder[] = [];
      try {
        orders = await this.fetchShopifyOrders();
        this.logger.log("info", `Found ${orders.length} orders from Shopify`);
      } catch (fetchError) {
        this.logger.log("error", "Failed to fetch orders from Shopify", {
          error: fetchError,
        });
        // Return empty result instead of throwing to prevent API failure
        return {
          totalOrders: 0,
          successfulImports: 0,
          failedImports: 0,
          skippedOrders: 0,
          duration: `${Date.now() - startTime}ms`,
          error:
            fetchError instanceof Error ? fetchError.message : "Unknown error",
        };
      }

      let successfulImports = 0;
      let failedImports = 0;
      let skippedOrders = 0;

      // Process each order
      for (const order of orders) {
        try {
          const result = await this.processOrder(order);
          if (result === "success") {
            successfulImports++;
          } else if (result === "skipped") {
            skippedOrders++;
          }
        } catch (error) {
          this.logger.log("error", `Failed to process order ${order.name}`, {
            error,
          });
          failedImports++;
        }
      }

      const duration = `${Date.now() - startTime}ms`;
      const result = {
        totalOrders: orders.length,
        successfulImports,
        failedImports,
        skippedOrders,
        duration,
      };

      this.logger.log("info", "Order sync completed", result);
      return result;
    } catch (error) {
      this.logger.log("error", "Order sync failed", { error });
      throw error;
    }
  }

  /**
   * Fetch orders from Shopify API with specific tag filter
   */
  private async fetchShopifyOrders(): Promise<ShopifyOrder[]> {
    const settings = SystemSettingsService.getSettings();
    const importTag = settings.shopifyImportTag;
    const url = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/${
      process.env.SHOPIFY_API_VERSION
    }/orders.json?limit=50&status=any&tags=${encodeURIComponent(importTag)}`;

    this.logger.log(
      "info",
      `Fetching orders with tag "${importTag}" from: ${url}`
    );

    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      this.logger.log(
        "error",
        `Failed to fetch orders: ${response.status} ${response.statusText}`
      );
      throw new Error(
        `Failed to fetch orders: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    const allOrders = data.orders || [];

    // Filter orders that actually have the import tag
    const filteredOrders = allOrders.filter((order: any) => {
      const orderTags = order.tags || "";
      return orderTags.includes(importTag);
    });

    this.logger.log(
      "info",
      `Shopify API returned ${allOrders.length} orders, ${filteredOrders.length} have tag "${importTag}"`
    );
    return filteredOrders;
  }

  /**
   * Process a single order
   */
  private async processOrder(
    order: ShopifyOrder
  ): Promise<"success" | "skipped"> {
    // Check if order already exists using DatabaseService
    const orderExists = await this.databaseService.checkOrderExists(order.name);

    this.logger.log(
      "debug",
      `Checking order ${order.name} (ID: ${order.id}): exists=${orderExists}`
    );

    if (orderExists) {
      this.logger.log("info", `Order ${order.name} already exists, skipping`);
      return "skipped";
    }

    // Prepare customer data
    const customerData: CustomerUpsertData = {
      email: order.customer?.email || order.email || "",
      name:
        order.customer?.first_name && order.customer?.last_name
          ? `${order.customer.first_name} ${order.customer.last_name}`
          : order.customer?.first_name ||
            order.customer?.last_name ||
            undefined,
      first_name: order.customer?.first_name,
      last_name: order.customer?.last_name,
      phone: order.customer?.phone || order.phone,
      billing_addr: order.billing_address
        ? this.mapShopifyAddress(order.billing_address)
        : undefined,
      shipping_addr: order.shipping_address
        ? this.mapShopifyAddress(order.shipping_address)
        : undefined,
    };

    // Prepare order data
    const orderData: OrderInsertData = {
      purchase_from: "shopify",
      order_date: order.created_at,
      total_amount: parseFloat(order.total_price),
      shopify_order_number: order.name, // Store Shopify order number (e.g., #1001, #1002)
      bill_to_name: order.billing_address
        ? `${order.billing_address.first_name || ""} ${
            order.billing_address.last_name || ""
          }`.trim()
        : undefined,
      ship_to_name: order.shipping_address
        ? `${order.shipping_address.first_name || ""} ${
            order.shipping_address.last_name || ""
          }`.trim()
        : undefined,
    };

    // Prepare order items with images
    this.logger.log(
      "info",
      `Processing ${order.line_items.length} line items for order ${order.name}`
    );

    const orderItems: OrderItemInsertData[] = await Promise.all(
      order.line_items.map(async (lineItem) => {
        // Fetch product image URL and variant details
        const imageUrl = await this.shopifyService.getProductImageUrl(lineItem);
        const variantDetails = await this.shopifyService.getVariantDetails(lineItem);

        // Extract order-specific properties from line item
        const properties = lineItem.properties || [];

        // Extract specific properties for database columns
        const ringSize = this.extractProperty(properties, [
          "ring size",
          "size",
          "ring_size",
        ]);
        const metalType = variantDetails.metalType || this.extractProperty(properties, [
          "metal",
          "metal type",
          "metal_type",
          "metaltype",
        ]);
        const engraving = this.extractProperty(properties, [
          "engraving",
          "personalization",
          "text",
        ]);

        const orderSpecificDetails = this.buildOrderSpecificDetails(
          lineItem.title,
          properties
        );

        this.logger.log("debug", `Line item: ${lineItem.title}`, {
          sku: lineItem.sku,
          productId: lineItem.product_id,
          variantId: lineItem.variant_id,
          properties: properties.length,
          ringSize: ringSize || "Not found",
          metalType: metalType || "Not found",
          engraving: engraving || "Not found",
          imageUrl: imageUrl || "No image found",
        });

        return {
          order_id: "", // Will be set after order creation
          sku: lineItem.sku,
          details: orderSpecificDetails,
          price: parseFloat(lineItem.price),
          qty: lineItem.quantity,
          image: imageUrl || undefined,
          size: ringSize || undefined,
          metal_type: metalType || undefined,
        };
      })
    );

    // Prepare addresses
    const billingAddress: AddressInsertData | undefined = order.billing_address
      ? {
          order_id: "", // Will be set after order creation
          first_name: order.billing_address.first_name || "",
          last_name: order.billing_address.last_name || "",
          company: order.billing_address.company,
          street1: order.billing_address.address1 || "",
          street2: order.billing_address.address2,
          city: order.billing_address.city || "",
          region: order.billing_address.province || "",
          postcode: order.billing_address.zip || "",
          country: order.billing_address.country || "",
          phone: order.billing_address.phone,
          email: order.email,
        }
      : undefined;

    const shippingAddress: AddressInsertData | undefined =
      order.shipping_address
        ? {
            order_id: "", // Will be set after order creation
            first_name: order.shipping_address.first_name || "",
            last_name: order.shipping_address.last_name || "",
            company: order.shipping_address.company,
            street1: order.shipping_address.address1 || "",
            street2: order.shipping_address.address2,
            city: order.shipping_address.city || "",
            region: order.shipping_address.province || "",
            postcode: order.shipping_address.zip || "",
            country: order.shipping_address.country || "",
            phone: order.shipping_address.phone,
            email: order.email,
          }
        : undefined;

    // Create complete order using DatabaseService
    const orderId = await this.databaseService.createCompleteOrder(
      customerData,
      orderData,
      orderItems,
      billingAddress,
      shippingAddress
    );

    // Mark order as imported from Shopify
    await this.databaseService.markOrderAsImported(
      orderId,
      order.id.toString(),
      order.name
    );

    // Update Shopify order tags to mark as processed
    await this.updateOrderTags(order);

    this.logger.log(
      "info",
      `Successfully processed order ${order.name} (Shopify Order #${order.name})`,
      {
        orderId,
        shopifyOrderNumber: order.name,
        shopifyOrderId: order.id,
      }
    );
    return "success";
  }

  /**
   * Update Shopify order tags to mark as processed
   */
  private async updateOrderTags(order: ShopifyOrder): Promise<void> {
    try {
      const settings = SystemSettingsService.getSettings();
      const importTag = settings.shopifyImportTag;
      const processedTag = settings.shopifyProcessedTag;

      await this.shopifyService.retagOrder(
        order.id.toString(),
        importTag,
        processedTag
      );

      this.logger.log(
        "info",
        `Updated tags for order ${order.name}: removed "${importTag}", added "${processedTag}"`
      );
    } catch (error) {
      this.logger.log(
        "error",
        `Failed to update tags for order ${order.name}`,
        {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        }
      );
      // Don't throw error - tag update failure shouldn't stop the sync
    }
  }

  /**
   * Process existing order to update order items with images
   */
  private async processExistingOrder(
    order: ShopifyOrder
  ): Promise<"success" | "skipped"> {
    try {
      // Get existing order ID
      const existingOrderId = await this.databaseService.getOrderIdByShopifyId(
        order.id.toString()
      );
      if (!existingOrderId) {
        this.logger.log(
          "warn",
          `Could not find existing order ID for ${order.name}`
        );
        return "skipped";
      }

      this.logger.log(
        "info",
        `Processing existing order ${order.name} for image updates`
      );

      // Process order items with images
      this.logger.log(
        "info",
        `Processing ${order.line_items.length} line items for order ${order.name}`
      );

      const orderItems: OrderItemInsertData[] = await Promise.all(
        order.line_items.map(async (lineItem) => {
          // Fetch product image URL
          const imageUrl = await this.shopifyService.getProductImageUrl(
            lineItem
          );

          // Extract order-specific properties from line item
          const properties = lineItem.properties || [];

          // Extract specific properties for database columns
          const ringSize = this.extractProperty(properties, [
            "ring size",
            "size",
            "ring_size",
          ]);
          const metalType = this.extractProperty(properties, [
            "metal",
            "metal type",
            "metal_type",
            "metaltype",
          ]);
          const engraving = this.extractProperty(properties, [
            "engraving",
            "personalization",
            "text",
          ]);

          const orderSpecificDetails = this.buildOrderSpecificDetails(
            lineItem.title,
            properties
          );

          this.logger.log("debug", `Line item: ${lineItem.title}`, {
            sku: lineItem.sku,
            productId: lineItem.product_id,
            variantId: lineItem.variant_id,
            properties: properties.length,
            ringSize: ringSize || "Not found",
            metalType: metalType || "Not found",
            engraving: engraving || "Not found",
            imageUrl: imageUrl || "No image found",
          });

          return {
            order_id: existingOrderId, // Add required order_id field
            sku: lineItem.sku,
            details: orderSpecificDetails,
            price: parseFloat(lineItem.price),
            qty: lineItem.quantity,
            image: imageUrl || undefined,
            size: ringSize || undefined,
            metal_type: metalType || undefined,
          };
        })
      );

      // Note: We don't update existing orders as per user requirements
      this.logger.log(
        "info",
        `Order ${order.name} already exists, skipping image update`
      );
      return "success";
    } catch (error) {
      this.logger.log(
        "error",
        `Failed to process existing order ${order.name}`,
        { error }
      );
      return "skipped";
    }
  }

  /**
   * Extract a specific property from the properties array
   */
  private extractProperty(
    properties: Array<{ name: string; value: string }>,
    possibleNames: string[]
  ): string | null {
    for (const prop of properties) {
      const propName = prop.name.toLowerCase().trim();
      for (const possibleName of possibleNames) {
        if (propName === possibleName.toLowerCase().trim()) {
          return prop.value;
        }
      }
    }
    return null;
  }

  /**
   * Build order-specific details from line item title and properties
   */
  private buildOrderSpecificDetails(
    title: string,
    properties: Array<{ name: string; value: string }>
  ): string {
    // Start with the base title
    let details = title;

    // Add order-specific properties
    if (properties && properties.length > 0) {
      const propertyDetails = properties
        .map((prop) => `${prop.name}: ${prop.value}`)
        .join(", ");

      if (propertyDetails) {
        details += ` (${propertyDetails})`;
      }
    }

    return details;
  }

  /**
   * Map Shopify address to our address format
   */
  private mapShopifyAddress(address: any): any {
    return {
      first_name: address.first_name,
      last_name: address.last_name,
      company: address.company,
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      province: address.province,
      zip: address.zip,
      country: address.country,
      phone: address.phone,
    };
  }
}
