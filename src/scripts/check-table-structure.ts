import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("CheckTableStructure");

async function checkTableStructure() {
  try {
    logger.info("Checking email_logs table structure...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to get all records without ordering to see what columns exist
    logger.info("Fetching all email_logs records...");

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .limit(5);

    logger.info("Query result:", {
      hasError: !!error,
      errorMessage: error ? error.message : null,
      dataLength: data ? data.length : 0,
      data: data,
    });

    if (data && data.length > 0) {
      logger.info("Sample record structure:", {
        sampleRecord: data[0],
        columns: Object.keys(data[0]),
      });
    }
  } catch (error) {
    logger.error("Table structure check failed:", error);
    process.exit(1);
  }
}

checkTableStructure();
