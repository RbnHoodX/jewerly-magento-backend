// System settings service for managing configuration and operations

import { Logger } from "../utils/logger";
import { ShopifyEmailService } from "./shopifyEmail";
import { AutomationService } from "./automation";
import { SyncService } from "./sync";
import { GoogleSheetsService } from "./googleSheetsFixed";
import { StatusModelService } from "./statusModelService";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SystemSettings {
  cronJobInterval: number; // in minutes
  syncEnabled: boolean;
  automationEnabled: boolean;
  emailNotifications: boolean;
  googleSheetsUrl: string;
  shopifyImportTag: string;
  shopifyProcessedTag: string;
  lastSyncTime?: string;
  lastAutomationTime?: string;
}

export interface OperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export class SystemSettingsService {
  private static logger = new Logger("SystemSettingsService");
  private static settings: SystemSettings = {
    cronJobInterval: 60,
    syncEnabled: false,
    automationEnabled: false,
    emailNotifications: true,
    googleSheetsUrl: "",
    shopifyImportTag: "new order",
    shopifyProcessedTag: "imported-to-admin",
  };

  /**
   * Get current system settings
   */
  static getSettings(): SystemSettings {
    return { ...this.settings };
  }

  /**
   * Update system settings
   */
  static updateSettings(newSettings: Partial<SystemSettings>): OperationResult {
    try {
      this.settings = { ...this.settings, ...newSettings };

      // Save to file or database
      this.saveSettings();

      this.logger.log("info", "Settings updated", { settings: this.settings });

      return {
        success: true,
        message: "Settings updated successfully",
        data: this.settings,
      };
    } catch (error) {
      this.logger.log("error", "Failed to update settings", { error });
      return {
        success: false,
        message: "Failed to update settings",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run sync once
   */
  static async runSyncOnce(): Promise<OperationResult> {
    try {
      this.logger.log("info", "Running sync once");

      const syncService = new SyncService();
      const result = await syncService.syncOrders();

      this.settings.lastSyncTime = new Date().toISOString();
      this.saveSettings();

      return {
        success: true,
        message: "Sync completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.log("error", "Sync failed", { error });
      return {
        success: false,
        message: "Sync failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Run automation once
   */
  static async runAutomationOnce(): Promise<OperationResult> {
    try {
      this.logger.log("info", "Running automation once");

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error("Supabase configuration missing");
      }

      const automationService = new AutomationService(supabaseUrl, supabaseKey);
      const result = await automationService.runAutomation();

      this.settings.lastAutomationTime = new Date().toISOString();
      this.saveSettings();

      return {
        success: true,
        message: "Automation completed successfully",
        data: result,
      };
    } catch (error) {
      this.logger.log("error", "Automation failed", { error });
      return {
        success: false,
        message: "Automation failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Test email sending
   */
  static async testEmail(
    emailAddress: string = "test@example.com"
  ): Promise<OperationResult> {
    try {
      this.logger.log("info", "Testing email sending", { emailAddress });

      // Log environment variables for debugging
      this.logger.log("info", "Email service environment check", {
        GMAIL_USER: process.env.GMAIL_USER ? "SET" : "NOT SET",
        GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? "SET" : "NOT SET",
        SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? "SET" : "NOT SET",
        FROM_EMAIL: process.env.FROM_EMAIL || "NOT SET",
      });

      const emailService = new ShopifyEmailService();
      const result = await emailService.sendEmail({
        to: emailAddress,
        subject: "PrimeStyle System Test Email",
        body: `This is a test email from the PrimeStyle automation system sent to ${emailAddress}.\n\nIf you received this email, the email system is working correctly!`,
      });

      return {
        success: true,
        message: `Test email sent successfully to ${emailAddress}`,
        data: { emailId: result, emailAddress },
      };
    } catch (error) {
      this.logger.log("error", "Email test failed", { error, emailAddress });
      return {
        success: false,
        message: "Email test failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Import status model from Google Sheets
   */
  static async importStatusModel(
    googleSheetsUrl: string
  ): Promise<OperationResult> {
    try {
      this.logger.log("info", "Importing status model from Google Sheets", {
        url: googleSheetsUrl,
      });

      // Validate Google Sheets URL
      const validation = GoogleSheetsService.validateUrl(googleSheetsUrl);
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid Google Sheets URL");
      }

      // Initialize services
      const googleSheetsService = new GoogleSheetsService();
      const statusModelService = new StatusModelService();

      // Fetch data from Google Sheets
      const sheetsResult = await googleSheetsService.importStatusModel(
        googleSheetsUrl
      );
      if (!sheetsResult.success || !sheetsResult.data) {
        throw new Error(
          sheetsResult.error || "Failed to fetch data from Google Sheets"
        );
      }

      this.logger.log("info", "Data fetched from Google Sheets", {
        recordCount: sheetsResult.data.length,
      });

      // Import data into Supabase
      await statusModelService.importAndReplaceData(sheetsResult.data);

      this.logger.log("info", "Status model data imported successfully", {
        recordCount: sheetsResult.data.length,
        url: googleSheetsUrl,
      });

      return {
        success: true,
        message: `Status model imported successfully - ${sheetsResult.data.length} records`,
        data: {
          importedRecords: sheetsResult.data.length,
          url: googleSheetsUrl,
          importedAt: new Date().toISOString(),
          records: sheetsResult.data,
        },
      };
    } catch (error) {
      this.logger.log("error", "Status model import failed", { error });
      return {
        success: false,
        message: "Failed to import status model",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get system status
   */
  static getSystemStatus(): OperationResult {
    try {
      const status = {
        sync: {
          enabled: this.settings.syncEnabled,
          lastRun: this.settings.lastSyncTime,
          nextRun: this.settings.syncEnabled
            ? new Date(
                Date.now() + this.settings.cronJobInterval * 60000
              ).toISOString()
            : null,
        },
        automation: {
          enabled: this.settings.automationEnabled,
          lastRun: this.settings.lastAutomationTime,
          nextRun: this.settings.automationEnabled
            ? new Date(
                Date.now() + this.settings.cronJobInterval * 60000
              ).toISOString()
            : null,
        },
        email: {
          enabled: this.settings.emailNotifications,
          configured: true, // This would check if email is properly configured
        },
        cronJob: {
          interval: this.settings.cronJobInterval,
          enabled: this.settings.syncEnabled || this.settings.automationEnabled,
        },
      };

      return {
        success: true,
        message: "System status retrieved successfully",
        data: status,
      };
    } catch (error) {
      this.logger.log("error", "Failed to get system status", { error });
      return {
        success: false,
        message: "Failed to get system status",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Save settings to file
   */
  private static saveSettings(): void {
    try {
      // Create config directory if it doesn't exist
      const configDir = path.join(__dirname, "../config");
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const settingsPath = path.join(configDir, "system-settings.json");
      fs.writeFileSync(settingsPath, JSON.stringify(this.settings, null, 2));

      this.logger.log("info", "Settings saved to file", { path: settingsPath });
    } catch (error) {
      this.logger.log("error", "Failed to save settings to file", { error });
    }
  }

  /**
   * Load settings from file
   */
  static loadSettings(): void {
    try {
      // Create config directory if it doesn't exist
      const configDir = path.join(__dirname, "../config");
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const settingsPath = path.join(configDir, "system-settings.json");

      if (fs.existsSync(settingsPath)) {
        const data = fs.readFileSync(settingsPath, "utf8");
        this.settings = { ...this.settings, ...JSON.parse(data) };
        this.logger.log("info", "Settings loaded from file", {
          path: settingsPath,
        });
      } else {
        // Create default settings file
        this.saveSettings();
        this.logger.log("info", "Created default settings file", {
          path: settingsPath,
        });
      }
    } catch (error) {
      this.logger.log("error", "Failed to load settings from file", { error });
      // Continue with default settings if loading fails
    }
  }
}
