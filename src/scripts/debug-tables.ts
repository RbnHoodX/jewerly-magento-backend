import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("DebugTables");

async function debugTables() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check all tables that might contain customer notes
    const tablesToCheck = [
      "order_customer_notes",
      "customer_notes",
      "order_notes",
      "notes",
      "order_status_history",
      "order_status",
      "order_comments",
      "comments",
    ];

    for (const tableName of tablesToCheck) {
      logger.info(`Checking table: ${tableName}`);

      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select("*", { count: "exact" })
          .limit(5);

        if (error) {
          if (error.code === "PGRST106") {
            logger.info(`  Table ${tableName} does not exist`);
          } else {
            logger.error(`  Error with table ${tableName}:`, error);
          }
        } else {
          logger.info(`  Table ${tableName}: ${count || 0} records`);
          if (data && data.length > 0) {
            logger.info(`  Sample data:`, data[0]);
          }
        }
      } catch (err) {
        logger.error(`  Exception with table ${tableName}:`, err);
      }
    }

    // Check if there are any tables with "note" in the name
    logger.info("Checking for tables with 'note' in the name...");
    const { data: tables, error: tablesError } = await supabase.rpc(
      "get_table_names"
    );

    if (tablesError) {
      logger.info(
        "Cannot get table names via RPC, trying alternative approach..."
      );

      // Try to query information_schema
      const { data: schemaData, error: schemaError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "public")
        .ilike("table_name", "%note%");

      if (schemaError) {
        logger.error("Cannot access schema information:", schemaError);
      } else {
        logger.info("Tables with 'note' in name:", schemaData);
      }
    } else {
      logger.info("All tables:", tables);
    }
  } catch (error) {
    logger.error("Debug failed:", error);
  }
}

debugTables();
