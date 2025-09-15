import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("CheckActualTableStructure");

async function checkActualTableStructure() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error("Missing Supabase credentials (need service role key)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Try to get the actual table structure by querying information_schema
    logger.info("Checking actual table structure...");

    const { data: columns, error: columnsError } = await supabase.rpc(
      "get_table_columns",
      { table_name: "order_customer_notes" }
    );

    if (columnsError) {
      logger.info("RPC not available, trying direct query...");

      // Try a different approach - query the table with minimal data
      const { data, error } = await supabase
        .from("order_customer_notes")
        .select("*")
        .limit(1);

      if (error) {
        logger.error("Cannot query table:", error);

        // Try to create a simple record to see what columns are required
        logger.info(
          "Trying to create a minimal record to see required columns..."
        );

        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .limit(1);

        if (orders && orders.length > 0) {
          const orderId = orders[0].id;

          // Try with just the minimum required fields
          const { data: testData, error: testError } = await supabase
            .from("order_customer_notes")
            .insert({
              order_id: orderId,
              status: "Test Status",
            })
            .select()
            .single();

          if (testError) {
            logger.error("Minimal insert failed:", testError);
          } else {
            logger.info("Minimal insert succeeded:", testData);
          }
        }
      } else {
        logger.info("Table structure (sample record):", data);
      }
    } else {
      logger.info("Table columns:", columns);
    }

    // Also check if the table exists at all
    logger.info("Checking if table exists...");
    const { data: tables, error: tablesError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "order_customer_notes");

    if (tablesError) {
      logger.error("Cannot check table existence:", tablesError);
    } else {
      logger.info("Table existence check:", tables);
    }
  } catch (error) {
    logger.error("Check failed:", error);
  }
}

checkActualTableStructure();
