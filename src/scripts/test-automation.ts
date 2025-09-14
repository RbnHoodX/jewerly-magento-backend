#!/usr/bin/env node

import { config } from "dotenv";
import { AutomationRunner } from "../automationRunner";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const logger = new Logger("TestAutomation");

async function testAutomation(): Promise<void> {
  try {
    logger.log("info", "Starting automation test");

    const runner = new AutomationRunner();

    // Test run once
    logger.log("info", "Running automation once for testing");
    await runner.runOnce();

    logger.log("info", "Automation test completed successfully");
  } catch (error) {
    logger.log("error", "Automation test failed", { error });
    console.error(
      "Test Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the test
testAutomation();
