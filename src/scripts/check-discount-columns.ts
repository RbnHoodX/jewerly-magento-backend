// Script to check if discount columns exist and provide SQL commands

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("CheckDiscountColumns");

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

async function checkDiscountColumns() {
  try {
    logger.log("info", "Checking if discount columns exist in orders table");

    // Try to select from the orders table with discount columns
    const { data: orders, error: selectError } = await supabase
      .from("orders")
      .select("id, discount_amount, discount_codes")
      .limit(1);

    if (selectError) {
      if (selectError.code === "PGRST116") {
        logger.log("warn", "Discount columns do not exist in the orders table");
        logger.log(
          "info",
          "Please run the following SQL commands in your Supabase dashboard:"
        );
        logger.log("info", "");
        logger.log("info", "-- Add discount amount column");
        logger.log(
          "info",
          "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;"
        );
        logger.log("info", "");
        logger.log("info", "-- Add discount codes column");
        logger.log(
          "info",
          "ALTER TABLE orders ADD COLUMN discount_codes JSONB DEFAULT '[]'::jsonb;"
        );
        logger.log("info", "");
        logger.log("info", "-- Add comments to the columns");
        logger.log(
          "info",
          "COMMENT ON COLUMN orders.discount_amount IS 'Total discount amount applied to the order';"
        );
        logger.log(
          "info",
          "COMMENT ON COLUMN orders.discount_codes IS 'Array of discount codes applied to the order';"
        );
        logger.log("info", "");
        logger.log(
          "info",
          "After running these commands, the discount functionality will be available."
        );
      } else {
        logger.log("error", "Error checking discount columns", {
          error: selectError,
        });
        throw selectError;
      }
    } else {
      logger.log("info", "Discount columns exist in the orders table");
      logger.log("info", "Sample data:", { orders: orders?.[0] });
    }
  } catch (error) {
    logger.log("error", "Failed to check discount columns", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the check
checkDiscountColumns()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
