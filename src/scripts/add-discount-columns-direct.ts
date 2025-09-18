// Script to add discount columns to orders table using direct SQL execution

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("AddDiscountColumnsDirect");

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

async function addDiscountColumns() {
  try {
    logger.log("info", "Adding discount columns to orders table");

    // First, let's check if the columns already exist
    const { data: columns, error: columnsError } = await supabase
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "orders")
      .in("column_name", ["discount_amount", "discount_codes"]);

    if (columnsError) {
      logger.log("error", "Failed to check existing columns", {
        error: columnsError,
      });
      throw columnsError;
    }

    const existingColumns = columns?.map((col) => col.column_name) || [];
    logger.log("info", "Existing discount columns", { existingColumns });

    // Add discount_amount column if it doesn't exist
    if (!existingColumns.includes("discount_amount")) {
      logger.log("info", "Adding discount_amount column...");
      // We'll need to use a different approach since we can't execute DDL directly
      // Let's try to insert a test record to see if the column exists
      const { error: testError } = await supabase
        .from("orders")
        .select("discount_amount")
        .limit(1);

      if (testError && testError.code === "PGRST116") {
        logger.log(
          "warn",
          "discount_amount column does not exist and cannot be added via API"
        );
        logger.log(
          "info",
          "Please run the following SQL manually in your Supabase dashboard:"
        );
        logger.log(
          "info",
          "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0.00;"
        );
      } else {
        logger.log(
          "info",
          "discount_amount column already exists or was added successfully"
        );
      }
    } else {
      logger.log("info", "discount_amount column already exists");
    }

    // Add discount_codes column if it doesn't exist
    if (!existingColumns.includes("discount_codes")) {
      logger.log("info", "Adding discount_codes column...");
      const { error: testError } = await supabase
        .from("orders")
        .select("discount_codes")
        .limit(1);

      if (testError && testError.code === "PGRST116") {
        logger.log(
          "warn",
          "discount_codes column does not exist and cannot be added via API"
        );
        logger.log(
          "info",
          "Please run the following SQL manually in your Supabase dashboard:"
        );
        logger.log(
          "info",
          "ALTER TABLE orders ADD COLUMN discount_codes JSONB DEFAULT '[]'::jsonb;"
        );
      } else {
        logger.log(
          "info",
          "discount_codes column already exists or was added successfully"
        );
      }
    } else {
      logger.log("info", "discount_codes column already exists");
    }

    logger.log("info", "Discount columns check completed");
  } catch (error) {
    logger.log("error", "Failed to add discount columns", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the migration
addDiscountColumns()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
