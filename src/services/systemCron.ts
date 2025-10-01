import { SystemSettingsService } from "./systemSettings";
import { SyncService } from "./sync";
import { UltraOptimizedAutomationService } from "./automationUltraOptimized";
import { Logger } from "../utils/logger";

export class SystemCronService {
  private syncService: SyncService;
  private automationService: UltraOptimizedAutomationService;
  private logger: Logger;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private automationIntervalId: NodeJS.Timeout | null = null;
  private isSyncRunning = false;
  private isAutomationRunning = false;

  constructor() {
    this.logger = new Logger("SystemCronService");

    // Initialize services
    this.syncService = new SyncService();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    this.automationService = new UltraOptimizedAutomationService(supabaseUrl, supabaseKey);
  }

  /**
   * Start all enabled cron jobs
   */
  start(): void {
    this.logger.log("info", "Starting system cron jobs");

    const settings = SystemSettingsService.getSettings();
    const intervalMs = settings.cronJobInterval * 60000; // Convert minutes to milliseconds

    this.logger.log(
      "info",
      `Cron job interval set to ${settings.cronJobInterval} minutes (${intervalMs}ms)`
    );

    // Start sync cron job if enabled
    if (settings.syncEnabled) {
      this.startSyncCron(intervalMs);
    } else {
      this.logger.log("info", "Sync cron job is disabled");
    }

    // Start automation cron job if enabled
    if (settings.automationEnabled) {
      this.startAutomationCron(intervalMs);
    } else {
      this.logger.log("info", "Automation cron job is disabled");
    }

    this.logger.log("info", "System cron jobs started successfully");
  }

  /**
   * Stop all cron jobs
   */
  stop(): void {
    this.logger.log("info", "Stopping system cron jobs");

    this.stopSyncCron();
    this.stopAutomationCron();

    this.logger.log("info", "All system cron jobs stopped");
  }

  /**
   * Restart cron jobs (useful when settings change)
   */
  restart(): void {
    this.logger.log("info", "Restarting system cron jobs");
    this.stop();
    this.start();
  }

  /**
   * Start sync cron job
   */
  private startSyncCron(intervalMs: number): void {
    if (this.syncIntervalId) {
      this.logger.log("warn", "Sync cron job is already running");
      return;
    }

    this.logger.log(
      "info",
      `Starting sync cron job with ${intervalMs}ms interval`
    );

    // Record start time
    this.syncStartTime = Date.now();

    // Run immediately on start
    this.runSyncJob();

    // Then run at the configured interval
    this.syncIntervalId = setInterval(() => {
      this.syncStartTime = Date.now(); // Update start time for next cycle
      this.runSyncJob();
    }, intervalMs);
  }

  /**
   * Stop sync cron job
   */
  private stopSyncCron(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      this.syncStartTime = null;
      this.logger.log("info", "Sync cron job stopped");
    }
  }

  /**
   * Start automation cron job
   */
  private startAutomationCron(intervalMs: number): void {
    if (this.automationIntervalId) {
      this.logger.log("warn", "Automation cron job is already running");
      return;
    }

    this.logger.log(
      "info",
      `Starting automation cron job with ${intervalMs}ms interval`
    );

    // Record start time
    this.automationStartTime = Date.now();

    // Run immediately on start
    this.runAutomationJob();

    // Then run at the configured interval
    this.automationIntervalId = setInterval(() => {
      this.automationStartTime = Date.now(); // Update start time for next cycle
      this.runAutomationJob();
    }, intervalMs);
  }

  /**
   * Stop automation cron job
   */
  private stopAutomationCron(): void {
    if (this.automationIntervalId) {
      clearInterval(this.automationIntervalId);
      this.automationIntervalId = null;
      this.automationStartTime = null;
      this.logger.log("info", "Automation cron job stopped");
    }
  }

  /**
   * Run sync job
   */
  private async runSyncJob(): Promise<void> {
    if (this.isSyncRunning) {
      this.logger.log(
        "warn",
        "Sync job is already running, skipping this execution"
      );
      return;
    }

    this.isSyncRunning = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      this.logger.log("info", "🔄 CRON: Starting sync job execution", {
        timestamp,
        jobType: "sync",
      });

      const result = await this.syncService.syncOrders();

      const duration = Date.now() - startTime;
      this.logger.log("info", "✅ CRON: Sync job completed successfully", {
        timestamp,
        jobType: "sync",
        duration: `${duration}ms`,
        result: {
          totalOrders: result.totalOrders,
          successfulImports: result.successfulImports,
          failedImports: result.failedImports,
          skippedOrders: result.skippedOrders,
        },
      });

      // Update last sync time in settings
      SystemSettingsService.updateSettings({
        lastSyncTime: timestamp,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.log("error", "❌ CRON: Sync job failed", {
        timestamp,
        jobType: "sync",
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isSyncRunning = false;
    }
  }

  /**
   * Run automation job
   */
  private async runAutomationJob(): Promise<void> {
    if (this.isAutomationRunning) {
      this.logger.log(
        "warn",
        "Automation job is already running, skipping this execution"
      );
      return;
    }

    this.isAutomationRunning = true;
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      this.logger.log("info", "🤖 CRON: Starting automation job execution", {
        timestamp,
        jobType: "automation",
      });

      const result = await this.automationService.runAutomation();

      const duration = Date.now() - startTime;
      this.logger.log(
        "info",
        "✅ CRON: Automation job completed successfully",
        {
          timestamp,
          jobType: "automation",
          duration: `${duration}ms`,
          result,
        }
      );

      // Update last automation time in settings
      SystemSettingsService.updateSettings({
        lastAutomationTime: timestamp,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.log("error", "❌ CRON: Automation job failed", {
        timestamp,
        jobType: "automation",
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isAutomationRunning = false;
    }
  }

  private syncStartTime: number | null = null;
  private automationStartTime: number | null = null;

  /**
   * Get the current status of all cron jobs
   */
  getStatus(): {
    sync: {
      enabled: boolean;
      running: boolean;
      hasInterval: boolean;
      nextRun?: string;
      timeUntilNext?: number;
    };
    automation: {
      enabled: boolean;
      running: boolean;
      hasInterval: boolean;
      nextRun?: string;
      timeUntilNext?: number;
    };
    settings: {
      interval: number;
      syncEnabled: boolean;
      automationEnabled: boolean;
    };
  } {
    const settings = SystemSettingsService.getSettings();
    const now = Date.now();
    const intervalMs = settings.cronJobInterval * 60000;

    // Calculate next run times
    const syncNextRun = this.syncStartTime
      ? new Date(this.syncStartTime + intervalMs)
      : null;
    const automationNextRun = this.automationStartTime
      ? new Date(this.automationStartTime + intervalMs)
      : null;

    return {
      sync: {
        enabled: settings.syncEnabled,
        running: this.isSyncRunning,
        hasInterval: this.syncIntervalId !== null,
        nextRun: syncNextRun?.toISOString(),
        timeUntilNext: syncNextRun
          ? Math.max(0, syncNextRun.getTime() - now)
          : undefined,
      },
      automation: {
        enabled: settings.automationEnabled,
        running: this.isAutomationRunning,
        hasInterval: this.automationIntervalId !== null,
        nextRun: automationNextRun?.toISOString(),
        timeUntilNext: automationNextRun
          ? Math.max(0, automationNextRun.getTime() - now)
          : undefined,
      },
      settings: {
        interval: settings.cronJobInterval,
        syncEnabled: settings.syncEnabled,
        automationEnabled: settings.automationEnabled,
      },
    };
  }

  /**
   * Force run sync job (for testing or manual execution)
   */
  async forceRunSync(): Promise<void> {
    this.logger.log("info", "Force running sync job");
    await this.runSyncJob();
  }

  /**
   * Force run automation job (for testing or manual execution)
   */
  async forceRunAutomation(): Promise<void> {
    this.logger.log("info", "Force running automation job");
    await this.runAutomationJob();
  }
}
