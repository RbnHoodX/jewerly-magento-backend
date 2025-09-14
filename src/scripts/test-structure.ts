#!/usr/bin/env node

import { Logger } from "../utils/logger";

const logger = new Logger("TestStructure");

async function testStructure(): Promise<void> {
  try {
    logger.log("info", "Testing automation system structure...");

    // Test Logger
    logger.info("Logger is working correctly");
    logger.warn("This is a warning message");
    logger.error("This is an error message (for testing)");
    logger.debug("This is a debug message");

    // Test imports
    logger.info("Testing imports...");

    // Test AutomationService import
    try {
      const { AutomationService } = await import("../services/automation");
      logger.info("✅ AutomationService import successful");
    } catch (error) {
      logger.error("❌ AutomationService import failed", { error });
    }

    // Test CronService import
    try {
      const { CronService } = await import("../services/cron");
      logger.info("✅ CronService import successful");
    } catch (error) {
      logger.error("❌ CronService import failed", { error });
    }

    // Test ShopifyEmailService import
    try {
      const { ShopifyEmailService } = await import("../services/shopifyEmail");
      logger.info("✅ ShopifyEmailService import successful");
    } catch (error) {
      logger.error("❌ ShopifyEmailService import failed", { error });
    }

    // Test AutomationRunner import
    try {
      const { AutomationRunner } = await import("../automationRunner");
      logger.info("✅ AutomationRunner import successful");
    } catch (error) {
      logger.error("❌ AutomationRunner import failed", { error });
    }

    logger.info("🎉 All structure tests completed!");
  } catch (error) {
    logger.error("Structure test failed", { error });
    console.error(
      "Test Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the test
testStructure();
