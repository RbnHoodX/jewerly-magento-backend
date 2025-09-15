import { config } from "dotenv";
import { AutomationService } from "./services/automation";
import { CronService } from "./services/cron";
import { Logger } from "./utils/logger";

// Load environment variables
config();

/**
 * Main automation runner
 * This file can be run as a standalone service or integrated into the main sync process
 */

class AutomationRunner {
  private automationService: AutomationService;
  private cronService: CronService;
  private logger: Logger;

  constructor() {
    this.logger = new Logger("AutomationRunner");

    // Initialize services
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    this.automationService = new AutomationService(supabaseUrl, supabaseKey);
    this.cronService = new CronService(this.automationService);
  }

  /**
   * Start the automation service
   */
  async start(): Promise<void> {
    try {
      this.logger.log("info", "Starting automation runner");

      // Start the cron job
      this.cronService.start();

      this.logger.log("info", "Automation runner started successfully");

      // Keep the process alive
      this.keepAlive();
    } catch (error) {
      this.logger.log("error", "Failed to start automation runner", { error });
      throw error;
    }
  }

  /**
   * Stop the automation service
   */
  async stop(): Promise<void> {
    try {
      this.logger.log("info", "Stopping automation runner");

      this.cronService.stop();

      this.logger.log("info", "Automation runner stopped successfully");
    } catch (error) {
      this.logger.log("error", "Failed to stop automation runner", { error });
      throw error;
    }
  }

  /**
   * Run automation once (for testing or manual execution)
   */
  async runOnce(): Promise<void> {
    try {
      this.logger.log("info", "Running automation once");
      await this.automationService.runAutomation();
      this.logger.log("info", "Automation run completed");
    } catch (error) {
      this.logger.log("error", "Automation run failed", { error });
      throw error;
    }
  }

  /**
   * Get the current status
   */
  getStatus() {
    return this.cronService.getStatus();
  }

  /**
   * Keep the process alive
   */
  private keepAlive(): void {
    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      this.logger.log("info", "Received SIGINT, shutting down gracefully");
      await this.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      this.logger.log("info", "Received SIGTERM, shutting down gracefully");
      await this.stop();
      process.exit(0);
    });

    // Keep the process alive
    setInterval(() => {
      // Just keep the process running
    }, 1000);
  }
}

// If this file is run directly, start the automation runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new AutomationRunner();

  runner.start().catch((error) => {
    console.error("Failed to start automation runner:", error);
    process.exit(1);
  });
}

export { AutomationRunner };
