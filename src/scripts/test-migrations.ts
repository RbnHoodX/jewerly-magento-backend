#!/usr/bin/env node

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const logger = new Logger("TestMigrations");

async function testMigrations(): Promise<void> {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required"
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    logger.log("info", "Testing database migrations...");

    // Test statuses_model table
    const { data: rules, error: rulesError } = await supabase
      .from("statuses_model")
      .select("*")
      .limit(1);

    if (rulesError) {
      logger.log("error", "Failed to query statuses_model table", {
        error: rulesError,
      });
      throw rulesError;
    }

    logger.log("info", "✅ statuses_model table is accessible");

    // Test email_logs table
    const { data: logs, error: logsError } = await supabase
      .from("email_logs")
      .select("*")
      .limit(1);

    if (logsError) {
      logger.log("error", "Failed to query email_logs table", {
        error: logsError,
      });
      throw logsError;
    }

    logger.log("info", "✅ email_logs table is accessible");

    // Test order_customer_notes table
    const { data: notes, error: notesError } = await supabase
      .from("order_customer_notes")
      .select("*")
      .limit(1);

    if (notesError) {
      logger.log("error", "Failed to query order_customer_notes table", {
        error: notesError,
      });
      throw notesError;
    }

    logger.log("info", "✅ order_customer_notes table is accessible");

    logger.log("info", "🎉 All migrations are working correctly!");
  } catch (error) {
    logger.log("error", "Migration test failed", { error });
    console.error(
      "Test Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the test
testMigrations();
