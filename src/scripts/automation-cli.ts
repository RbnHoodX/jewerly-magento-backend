#!/usr/bin/env node

import { config } from "dotenv";
import { AutomationRunner } from "../automationRunner";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const logger = new Logger("AutomationCLI");

interface CLIArgs {
  command: string;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { command: "help", help: true };
  }

  return {
    command: args[0],
  };
}

function showHelp(): void {
  console.log(`
Automation CLI - Order Status Updates & Customer Communication

Usage: npm run automation <command>

Commands:
  start       Start the automation service (runs continuously)
  stop        Stop the automation service
  run-once    Run automation once and exit
  status      Show current status
  help        Show this help message

Environment Variables Required:
  SUPABASE_URL          - Supabase project URL
  SUPABASE_ANON_KEY     - Supabase anonymous key
  SHOPIFY_API_KEY       - Shopify API key (optional)
  SHOPIFY_API_SECRET    - Shopify API secret (optional)
  SHOPIFY_SHOP_DOMAIN   - Shopify shop domain (optional)

Examples:
  npm run automation start
  npm run automation run-once
  npm run automation status
`);
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    return;
  }

  let runner: AutomationRunner;

  try {
    runner = new AutomationRunner();
  } catch (error) {
    logger.log("error", "Failed to initialize automation runner", { error });
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  switch (args.command) {
    case "start":
      try {
        logger.log("info", "Starting automation service");
        await runner.start();
        logger.log("info", "Automation service started successfully");
      } catch (error) {
        logger.log("error", "Failed to start automation service", { error });
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
      break;

    case "stop":
      try {
        logger.log("info", "Stopping automation service");
        await runner.stop();
        logger.log("info", "Automation service stopped successfully");
        process.exit(0);
      } catch (error) {
        logger.log("error", "Failed to stop automation service", { error });
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
      break;

    case "run-once":
      try {
        logger.log("info", "Running automation once");
        await runner.runOnce();
        logger.log("info", "Automation completed successfully");
        process.exit(0);
      } catch (error) {
        logger.log("error", "Automation run failed", { error });
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
      break;

    case "status":
      try {
        const status = runner.getStatus();
        console.log("Automation Service Status:");
        console.log(`  Running: ${status.isRunning}`);
        console.log(`  Has Interval: ${status.hasInterval}`);
        if (status.lastRun) {
          console.log(`  Last Run: ${status.lastRun.toISOString()}`);
        }
      } catch (error) {
        logger.log("error", "Failed to get status", { error });
        console.error(
          "Error:",
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
      break;

    default:
      console.error(`Unknown command: ${args.command}`);
      showHelp();
      process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.log("error", "Uncaught exception", { error });
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.log("error", "Unhandled rejection", { reason, promise });
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the CLI
main().catch((error) => {
  logger.log("error", "CLI failed", { error });
  console.error("CLI Error:", error);
  process.exit(1);
});
