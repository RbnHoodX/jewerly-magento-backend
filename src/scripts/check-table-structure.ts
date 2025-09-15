import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("CheckTableStructure");

async function checkTableStructure() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Try to get the structure by selecting all columns
    logger.info("Checking order_customer_notes table structure...");

    const { data, error } = await supabase
      .from("order_customer_notes")
      .select("*")
      .limit(1);

    if (error) {
      logger.error("Error checking table structure:", error);

      // Try to get just the column names
      logger.info("Trying to get column names...");
      const { data: columns, error: columnError } = await supabase
        .from("order_customer_notes")
        .select("id")
        .limit(1);

      if (columnError) {
        logger.error("Cannot access table at all:", columnError);
      } else {
        logger.info("Table exists, checking individual columns...");

        // Test each column we expect
        const expectedColumns = [
          "id",
          "order_id",
          "status",
          "note",
          "content",
          "is_automated",
          "triggered_by_rule_id",
          "created_at",
          "created_by",
        ];

        for (const col of expectedColumns) {
          try {
            const { error: colError } = await supabase
              .from("order_customer_notes")
              .select(col)
              .limit(1);

            if (colError) {
              logger.info(`  Column '${col}': NOT FOUND`);
            } else {
              logger.info(`  Column '${col}': EXISTS`);
            }
          } catch (err) {
            logger.info(`  Column '${col}': ERROR - ${err}`);
          }
        }
      }
    } else {
      logger.info("Table structure (sample record):", data);
    }
  } catch (error) {
    logger.error("Check failed:", error);
  }
}

checkTableStructure();
