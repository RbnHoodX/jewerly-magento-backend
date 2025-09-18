// Script to update existing orders with new image and details logic

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ShopifyService } from "../services/shopify";
import { Logger } from "../utils/logger";

const logger = new Logger("UpdateExistingOrders");

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

// Initialize Shopify service
const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
const apiVersion = process.env.SHOPIFY_API_VERSION;
const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

if (!storeDomain || !apiVersion || !accessToken) {
  throw new Error("Shopify configuration missing");
}

const shopifyService = new ShopifyService(storeDomain, apiVersion, accessToken);

// Build order-specific details from line item title and properties
function buildOrderSpecificDetails(
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

async function updateExistingOrders() {
  try {
    logger.log("info", "Starting update of existing orders");

    // Get all orders with Shopify order numbers
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .not("shopify_order_number", "is", null);

    if (ordersError) {
      logger.log("error", "Failed to fetch orders from database", {
        error: ordersError,
      });
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      logger.log("info", "No orders found to update");
      return;
    }

    logger.log("info", `Found ${orders.length} orders to update`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const order of orders) {
      try {
        logger.log("info", `Processing order ${order.shopify_order_number}`);

        // Get Shopify order ID from notes table
        const { data: note, error: noteError } = await supabase
          .from("order_customer_notes")
          .select("content")
          .eq("order_id", order.id)
          .like("content", "Shopify Order:%")
          .limit(1)
          .maybeSingle();

        if (noteError) {
          logger.log(
            "error",
            `Failed to fetch note for order ${order.shopify_order_number}`,
            { error: noteError }
          );
          continue;
        }

        if (!note) {
          logger.log(
            "warn",
            `No Shopify note found for order ${order.shopify_order_number}`
          );
          continue;
        }

        // Extract Shopify order ID from note content (format: "Shopify Order: 6325975843000 (120311)")
        const shopifyOrderId = note.content
          .replace("Shopify Order: ", "")
          .split(" ")[0];

        logger.log(
          "debug",
          `Extracted Shopify order ID: ${shopifyOrderId} from note: ${note.content}`
        );

        // Fetch order from Shopify
        const shopifyOrder = await shopifyService.fetchOrder(shopifyOrderId);

        if (!shopifyOrder) {
          logger.log(
            "warn",
            `Order ${order.shopify_order_number} not found in Shopify`
          );
          continue;
        }

        // Get current order items
        const { data: currentItems, error: itemsError } = await supabase
          .from("order_items")
          .select("id, sku")
          .eq("order_id", order.id);

        if (itemsError) {
          logger.log(
            "error",
            `Failed to fetch items for order ${order.shopify_order_number}`,
            { error: itemsError }
          );
          continue;
        }

        // Update each order item
        for (const lineItem of shopifyOrder.line_items) {
          // Find matching order item by SKU
          const matchingItem = currentItems?.find(
            (item) => item.sku === lineItem.sku
          );

          if (!matchingItem) {
            logger.log(
              "warn",
              `No matching item found for SKU ${lineItem.sku} in order ${order.shopify_order_number}`
            );
            continue;
          }

          // Fetch product image URL
          const imageUrl = await shopifyService.getProductImageUrl(lineItem);

          // Extract order-specific properties from line item
          const properties = lineItem.properties || [];
          const orderSpecificDetails = buildOrderSpecificDetails(
            lineItem.title,
            properties
          );

          logger.log("debug", `Updating item: ${lineItem.title}`, {
            sku: lineItem.sku,
            productId: lineItem.product_id,
            variantId: lineItem.variant_id,
            properties: properties.length,
            imageUrl: imageUrl || "No image found",
          });

          // Update the order item
          const { error: updateError } = await supabase
            .from("order_items")
            .update({
              details: orderSpecificDetails,
              image: imageUrl || null,
            })
            .eq("id", matchingItem.id);

          if (updateError) {
            logger.log("error", `Failed to update item ${matchingItem.id}`, {
              error: updateError,
            });
            errorCount++;
          } else {
            logger.log(
              "info",
              `Updated item ${matchingItem.id} for order ${order.shopify_order_number}`
            );
            updatedCount++;
          }
        }
      } catch (error) {
        logger.log(
          "error",
          `Failed to process order ${order.shopify_order_number}`,
          {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          }
        );
        errorCount++;
      }
    }

    logger.log("info", "Update completed", {
      totalOrders: orders.length,
      updatedItems: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    logger.log("error", "Update failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the update
updateExistingOrders()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
