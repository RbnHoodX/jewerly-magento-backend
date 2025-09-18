// Script to check order IDs and Shopify order numbers

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("CheckOrderIds");

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

async function checkOrderIds() {
  try {
    logger.log("info", "Checking order IDs and Shopify order numbers");

    // Get orders with their notes
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select(
        `
        id,
        shopify_order_number,
        order_customer_notes (
          content
        )
      `
      )
      .not("shopify_order_number", "is", null)
      .limit(5);

    if (ordersError) {
      logger.log("error", "Failed to fetch orders", { error: ordersError });
      throw ordersError;
    }

    if (!orders || orders.length === 0) {
      logger.log("info", "No orders found");
      return;
    }

    logger.log("info", "Order data:", {
      orders: orders.map((order) => ({
        id: order.id,
        shopify_order_number: order.shopify_order_number,
        notes: order.order_customer_notes?.map((note) => note.content) || [],
      })),
    });
  } catch (error) {
    logger.log("error", "Failed to check order IDs", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the check
checkOrderIds()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
