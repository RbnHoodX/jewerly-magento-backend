import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("TestSupabaseConnection");

async function testSupabaseConnection() {
  try {
    logger.info("Testing Supabase connection...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    logger.info("Environment variables:", {
      supabaseUrl: supabaseUrl ? "✓" : "✗",
      supabaseKey: supabaseKey ? "✓" : "✗",
      supabaseUrlValue: supabaseUrl,
      supabaseKeyValue: supabaseKey
        ? `${supabaseKey.substring(0, 20)}...`
        : "undefined",
    });

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.info("Testing email_logs table query...");

    const { data, error } = await supabase
      .from("email_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(10);

    logger.info("Supabase query result:", {
      hasError: !!error,
      errorMessage: error ? error.message : null,
      errorCode: error ? error.code : null,
      errorDetails: error ? error.details : null,
      errorHint: error ? error.hint : null,
      dataLength: data ? data.length : 0,
      data: data,
    });

    if (error) {
      logger.error("Supabase query failed:", error);
      throw error;
    }

    logger.info("Supabase connection test successful!", {
      recordsFound: data ? data.length : 0,
      records: data,
    });
  } catch (error) {
    logger.error("Supabase connection test failed:", error);
    process.exit(1);
  }
}

testSupabaseConnection();
