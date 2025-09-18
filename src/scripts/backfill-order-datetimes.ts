// Script to backfill order dates with full datetime information

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { ShopifyService } from "../services/shopify";
import { Logger } from "../utils/logger";

const logger = new Logger("BackfillOrderDatetimes");

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

// Convert UTC date to EST datetime string (YYYY-MM-DD HH:MM:SS)
function convertToESTDateTime(utcDateString: string): string {
  const date = new Date(utcDateString);
  // Convert to EST and format as YYYY-MM-DD HH:MM:SS
  const estDate = new Date(date.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return estDate.toISOString().replace('T', ' ').split('.')[0];
}

async function backfillOrderDatetimes() {
  try {
    logger.log("info", "Starting backfill of order datetimes");

    // Get all orders with Shopify order numbers
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number, order_date")
      .not("shopify_order_number", "is", null);

    // Filter for orders with date-only format (YYYY-MM-DD) - length of 10 characters
    const ordersToUpdate = orders?.filter(order => 
      order.order_date && 
      typeof order.order_date === 'string' && 
      order.order_date.length === 10 &&
      /^\d{4}-\d{2}-\d{2}$/.test(order.order_date)
    ) || [];

    if (ordersError) {
      logger.log("error", "Failed to fetch orders from database", {
        error: ordersError,
      });
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    if (ordersToUpdate.length === 0) {
      logger.log("info", "No orders found to update");
      return;
    }

    logger.log("info", `Found ${ordersToUpdate.length} orders to update`);

    let updatedCount = 0;
    let errorCount = 0;

    for (const order of ordersToUpdate) {
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

        // Extract Shopify order ID from note content
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

        // Convert to EST datetime
        const estDateTime = convertToESTDateTime(shopifyOrder.created_at);

        logger.log("debug", `Converting order date`, {
          original: order.order_date,
          shopifyCreatedAt: shopifyOrder.created_at,
          estDateTime: estDateTime,
        });

        // Update the order with full datetime
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            order_date: estDateTime,
          })
          .eq("id", order.id);

        if (updateError) {
          logger.log("error", `Failed to update order ${order.id}`, {
            error: updateError,
          });
          errorCount++;
        } else {
          logger.log(
            "info",
            `Updated order ${order.shopify_order_number} with datetime: ${estDateTime}`
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
      totalOrders: ordersToUpdate.length,
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
backfillOrderDatetimes()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
