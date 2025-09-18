// Script to add shipping cost column to orders table

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("AddShippingCostColumn");

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

async function addShippingCostColumn() {
  try {
    logger.log(
      "info",
      "Checking if shipping_cost column exists in orders table"
    );

    // Try to select from the orders table with shipping_cost column
    const { data: orders, error: selectError } = await supabase
      .from("orders")
      .select("id, shipping_cost")
      .limit(1);

    if (selectError) {
      if (selectError.code === "PGRST116") {
        logger.log(
          "warn",
          "shipping_cost column does not exist in the orders table"
        );
        logger.log(
          "info",
          "Please run the following SQL command in your Supabase dashboard:"
        );
        logger.log("info", "");
        logger.log("info", "-- Add shipping cost column");
        logger.log(
          "info",
          "ALTER TABLE orders ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0.00;"
        );
        logger.log("info", "");
        logger.log("info", "-- Add comment to the column");
        logger.log(
          "info",
          "COMMENT ON COLUMN orders.shipping_cost IS 'Shipping cost for the order';"
        );
        logger.log("info", "");
        logger.log(
          "info",
          "After running these commands, the shipping cost functionality will be available."
        );
      } else {
        logger.log("error", "Error checking shipping_cost column", {
          error: selectError,
        });
        throw selectError;
      }
    } else {
      logger.log("info", "shipping_cost column exists in the orders table");
      logger.log("info", "Sample data:", { orders: orders?.[0] });
    }
  } catch (error) {
    logger.log("error", "Failed to check shipping_cost column", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the check
addShippingCostColumn()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
