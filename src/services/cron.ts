import { AutomationService } from "./automation";
import { Logger } from "../utils/logger";

export class CronService {
  private automationService: AutomationService;
  private logger: Logger;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(automationService: AutomationService) {
    this.automationService = automationService;
    this.logger = new Logger("CronService");
  }

  /**
   * Start the hourly cron job
   */
  start(): void {
    if (this.intervalId) {
      this.logger.log("warn", "Cron job is already running");
      return;
    }

    this.logger.log("info", "Starting hourly automation cron job");

    // Run immediately on start
    this.runAutomation();

    // Then run every hour (3600000 ms)
    this.intervalId = setInterval(() => {
      this.runAutomation();
    }, 3600000);

    this.logger.log("info", "Cron job started successfully");
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log("info", "Cron job stopped");
    } else {
      this.logger.log("warn", "Cron job is not running");
    }
  }

  /**
   * Run the automation workflow
   */
  private async runAutomation(): Promise<void> {
    if (this.isRunning) {
      this.logger.log(
        "warn",
        "Automation is already running, skipping this execution"
      );
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      this.logger.log("info", "Starting automation workflow");
      await this.automationService.runAutomation();

      const duration = Date.now() - startTime;
      this.logger.log("info", `Automation workflow completed in ${duration}ms`);
    } catch (error) {
      this.logger.log("error", "Automation workflow failed", { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get the current status of the cron job
   */
  getStatus(): {
    isRunning: boolean;
    hasInterval: boolean;
    lastRun?: Date;
  } {
    return {
      isRunning: this.isRunning,
      hasInterval: this.intervalId !== null,
    };
  }

  /**
   * Force run the automation (for testing or manual execution)
   */
  async forceRun(): Promise<void> {
    this.logger.log("info", "Force running automation workflow");
    await this.runAutomation();
  }
}
