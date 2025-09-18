// Script to add discount columns to orders table

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("AddDiscountColumns");

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

    // Add discount amount column
    const { error: discountAmountError } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0.00;",
    });

    if (discountAmountError) {
      logger.log("error", "Failed to add discount_amount column", {
        error: discountAmountError,
      });
    } else {
      logger.log("info", "Successfully added discount_amount column");
    }

    // Add discount codes column
    const { error: discountCodesError } = await supabase.rpc("exec_sql", {
      sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_codes JSONB DEFAULT '[]'::jsonb;",
    });

    if (discountCodesError) {
      logger.log("error", "Failed to add discount_codes column", {
        error: discountCodesError,
      });
    } else {
      logger.log("info", "Successfully added discount_codes column");
    }

    // Add comments to the columns
    const { error: commentError1 } = await supabase.rpc("exec_sql", {
      sql: "COMMENT ON COLUMN orders.discount_amount IS 'Total discount amount applied to the order';",
    });

    const { error: commentError2 } = await supabase.rpc("exec_sql", {
      sql: "COMMENT ON COLUMN orders.discount_codes IS 'Array of discount codes applied to the order';",
    });

    if (commentError1 || commentError2) {
      logger.log("warn", "Failed to add column comments", {
        commentError1,
        commentError2,
      });
    } else {
      logger.log("info", "Successfully added column comments");
    }

    logger.log("info", "Discount columns added successfully");
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
