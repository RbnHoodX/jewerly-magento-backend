// Script to backfill discount and shipping data for existing orders

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ShopifyService } from "../services/shopify";
import { Logger } from "../utils/logger";

const logger = new Logger("BackfillDiscountsAndShipping");

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

async function backfillDiscountsAndShipping() {
  try {
    logger.log("info", "Starting backfill of discount and shipping data");

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

        // Get Shopify order ID from notes
        const { data: note, error: noteError } = await supabase
          .from("order_customer_notes")
          .select("content")
          .eq("order_id", order.id)
          .like("content", "Shopify Order:%")
          .limit(1)
          .maybeSingle();

        if (noteError || !note) {
          logger.log(
            "warn",
            `No Shopify note found for order ${order.shopify_order_number}`
          );
          errorCount++;
          continue;
        }

        // Extract Shopify order ID from note content (format: "Shopify Order: 6325975843000 (120311)")
        const shopifyOrderId = note.content
          .replace("Shopify Order: ", "")
          .split(" ")[0];

        logger.log("debug", "Extracted Shopify order ID", {
          orderNumber: order.shopify_order_number,
          shopifyOrderId,
        });

        // Fetch order from Shopify
        const shopifyOrder = await shopifyService.fetchOrder(shopifyOrderId);

        if (!shopifyOrder) {
          logger.log("warn", `Shopify order ${shopifyOrderId} not found`);
          errorCount++;
          continue;
        }

        // Calculate discount data
        const totalDiscount =
          shopifyOrder.discount_codes?.reduce((sum, discount) => {
            const amount = parseFloat(discount.amount || "0");
            return sum + amount;
          }, 0) || 0;

        const discountCodes = shopifyOrder.discount_codes || [];

        // Get shipping cost
        const shippingCost = parseFloat(shopifyOrder.total_shipping || "0");

        logger.log("debug", "Order data from Shopify", {
          orderNumber: order.shopify_order_number,
          totalDiscount,
          discountCodes: discountCodes.length,
          shippingCost,
        });

        // Update the order in the database
        const updateData: any = {
          discount_amount: totalDiscount,
          discount_codes: discountCodes,
        };

        // Only add shipping_cost if the column exists
        try {
          const { error: shippingTestError } = await supabase
            .from("orders")
            .select("shipping_cost")
            .eq("id", order.id)
            .limit(1);

          if (!shippingTestError) {
            updateData.shipping_cost = shippingCost;
          }
        } catch (e) {
          logger.log("warn", "shipping_cost column does not exist, skipping");
        }

        const { error: updateError } = await supabase
          .from("orders")
          .update(updateData)
          .eq("id", order.id);

        if (updateError) {
          logger.log(
            "error",
            `Failed to update order ${order.shopify_order_number}`,
            { error: updateError }
          );
          errorCount++;
        } else {
          logger.log(
            "info",
            `Updated order ${order.shopify_order_number} with discount: $${totalDiscount}, shipping: $${shippingCost}`
          );
          updatedCount++;
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

    logger.log("info", "Backfill completed", {
      totalOrders: orders.length,
      updatedOrders: updatedCount,
      errors: errorCount,
    });
  } catch (error) {
    logger.log("error", "Backfill failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the backfill
backfillDiscountsAndShipping()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
