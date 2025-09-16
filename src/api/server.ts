// Express server for system settings API

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { SystemSettingsService } from "../services/systemSettings";
import { SystemCronService } from "../services/systemCron";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const app = express();
const logger = new Logger("SystemSettingsAPI");
const PORT = process.env.PORT || process.env.API_PORT || 3003;

// Log startup information
console.log("🚀 Starting Shopify Database Sync API Server");
console.log(`📦 Runtime: Bun ${process.version}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);

// Initialize cron service
let cronService: SystemCronService;
try {
  cronService = new SystemCronService();
  logger.log("info", "Cron service initialized successfully");
} catch (error) {
  logger.log("error", "Failed to initialize cron service", { error });
  process.exit(1);
}

// Middleware
app.use(cors());
app.use(express.json());

// Load settings on startup
SystemSettingsService.loadSettings();

// Start cron jobs if enabled
const settings = SystemSettingsService.getSettings();
if (settings.syncEnabled || settings.automationEnabled) {
  cronService.start();
  logger.log("info", "Cron jobs started on server startup");
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// System settings endpoints
app.get("/api/settings", (req, res) => {
  try {
    const settings = SystemSettingsService.getSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    logger.log("error", "Failed to get settings", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/settings", (req, res) => {
  try {
    const result = SystemSettingsService.updateSettings(req.body);

    // Restart cron jobs when settings change
    cronService.restart();
    logger.log("info", "Settings updated and cron jobs restarted");

    res.json(result);
  } catch (error) {
    logger.log("error", "Failed to update settings", { error });
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Sync endpoints
app.post("/api/sync/run-once", async (req, res) => {
  try {
    const result = await SystemSettingsService.runSyncOnce();
    res.json(result);
  } catch (error) {
    logger.log("error", "Sync API error", { error });
    res.status(500).json({
      success: false,
      message: "Sync failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/sync/status", (req, res) => {
  try {
    const result = SystemSettingsService.getSystemStatus();
    res.json(result);
  } catch (error) {
    logger.log("error", "Sync status API error", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get sync status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Automation endpoints
app.post("/api/automation/run-once", async (req, res) => {
  try {
    const result = await SystemSettingsService.runAutomationOnce();
    res.json(result);
  } catch (error) {
    logger.log("error", "Automation API error", { error });
    res.status(500).json({
      success: false,
      message: "Automation failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/automation/status", (req, res) => {
  try {
    const result = SystemSettingsService.getSystemStatus();
    res.json(result);
  } catch (error) {
    logger.log("error", "Automation status API error", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get automation status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Email endpoints
app.post("/api/email/test", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await SystemSettingsService.testEmail(
      email || "test@example.com"
    );
    res.json(result);
  } catch (error) {
    logger.log("error", "Email test API error", { error });
    res.status(500).json({
      success: false,
      message: "Email test failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/email/status", (req, res) => {
  try {
    const result = SystemSettingsService.getSystemStatus();
    res.json(result);
  } catch (error) {
    logger.log("error", "Email status API error", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get email status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Import endpoints
app.post("/api/import/status-model", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Google Sheets URL is required",
      });
    }

    const result = await SystemSettingsService.importStatusModel(url);
    res.json(result);
  } catch (error) {
    logger.log("error", "Import API error", { error });
    res.status(500).json({
      success: false,
      message: "Import failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Cron control endpoints
app.get("/api/cron/status", (req, res) => {
  try {
    const status = cronService.getStatus();
    res.json({
      success: true,
      message: "Cron status retrieved successfully",
      data: status,
    });
  } catch (error) {
    logger.log("error", "Failed to get cron status", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get cron status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/cron/start", (req, res) => {
  try {
    cronService.start();
    logger.log("info", "Cron jobs started via API");
    res.json({
      success: true,
      message: "Cron jobs started successfully",
    });
  } catch (error) {
    logger.log("error", "Failed to start cron jobs", { error });
    res.status(500).json({
      success: false,
      message: "Failed to start cron jobs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/cron/stop", (req, res) => {
  try {
    cronService.stop();
    logger.log("info", "Cron jobs stopped via API");
    res.json({
      success: true,
      message: "Cron jobs stopped successfully",
    });
  } catch (error) {
    logger.log("error", "Failed to stop cron jobs", { error });
    res.status(500).json({
      success: false,
      message: "Failed to stop cron jobs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.post("/api/cron/restart", (req, res) => {
  try {
    cronService.restart();
    logger.log("info", "Cron jobs restarted via API");
    res.json({
      success: true,
      message: "Cron jobs restarted successfully",
    });
  } catch (error) {
    logger.log("error", "Failed to restart cron jobs", { error });
    res.status(500).json({
      success: false,
      message: "Failed to restart cron jobs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Status model endpoints
app.get("/api/status-model/current", async (req, res) => {
  try {
    const { StatusModelService } = await import(
      "../services/statusModelService"
    );
    const statusModelService = new StatusModelService();
    const data = await statusModelService.getCurrentData();

    res.json({
      success: true,
      message: "Status model data retrieved successfully",
      data: {
        count: data.length,
        records: data,
      },
    });
  } catch (error) {
    logger.log("error", "Failed to get status model data", { error });
    res.status(500).json({
      success: false,
      message: "Failed to get status model data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Email logs endpoints
app.get("/api/email/logs", async (req, res) => {
  try {
    logger.log("info", "🔍 API: Starting email logs request", {
      timestamp: new Date().toISOString(),
    });

    const { EmailLoggingService } = await import(
      "../services/emailLoggingService"
    );
    logger.log("info", "🔍 API: EmailLoggingService imported successfully");

    const emailLoggingService = new EmailLoggingService();
    logger.log("info", "🔍 API: EmailLoggingService instance created");

    logger.log("info", "🔍 API: Calling emailLoggingService.getEmailLogs(50)");
    const logs = await emailLoggingService.getEmailLogs(50);

    logger.log("info", "🔍 API: EmailLoggingService returned data", {
      logsCount: logs ? logs.length : 0,
      logsData: logs,
      logsType: typeof logs,
      logsIsArray: Array.isArray(logs),
    });

    const response = {
      success: true,
      message: "Email logs retrieved successfully",
      data: {
        count: logs.length,
        logs: logs,
      },
    };

    logger.log("info", "🔍 API: Sending response", {
      responseData: response,
      responseType: typeof response,
    });

    res.json(response);
  } catch (error) {
    logger.log("error", "🔍 API: Failed to get email logs", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      success: false,
      message: "Failed to get email logs",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.log("error", "Unhandled error", { error });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
);

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log("✅ Server started successfully!");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🔒 CORS enabled for all origins`);
  console.log("🚀 Ready to accept requests!");
  
  logger.log("info", `System Settings API server running on port ${PORT}`);
  logger.log("info", `Health check available at: http://localhost:${PORT}/health`);
  logger.log("info", `Test endpoint available at: http://localhost:${PORT}/test`);
  logger.log("info", `CORS enabled for all origins`);
});

export default app;
