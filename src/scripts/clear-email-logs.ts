import { config } from "dotenv";
config();

import { EmailLoggingService } from "../services/emailLoggingService";
import { Logger } from "../utils/logger";

const logger = new Logger("ClearEmailLogs");

async function clearEmailLogs() {
  try {
    logger.info("Clearing all email logs from database...");

    const emailLoggingService = new EmailLoggingService();

    // Clear all email logs by deleting all records
    const { supabase } = emailLoggingService as any;

    const { error } = await supabase
      .from("email_logs")
      .delete()
      .gte("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

    if (error) {
      logger.error("Failed to clear email logs", { error: error.message });
      throw error;
    }

    logger.info("All email logs cleared successfully");

    // Verify the table is empty
    const { data: remainingLogs, error: fetchError } = await supabase
      .from("email_logs")
      .select("*");

    if (fetchError) {
      logger.error("Failed to verify email logs cleared", {
        error: fetchError.message,
      });
      throw fetchError;
    }

    logger.info("Verification complete", {
      remainingCount: remainingLogs ? remainingLogs.length : 0,
    });
  } catch (error) {
    logger.error("Failed to clear email logs:", error);
    process.exit(1);
  }
}

clearEmailLogs();
