// Express server for system settings API

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { SystemSettingsService } from "../services/systemSettings";
import { Logger } from "../utils/logger";

// Load environment variables
config();

const app = express();
const logger = new Logger("SystemSettingsAPI");
const PORT = process.env.API_PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Load settings on startup
SystemSettingsService.loadSettings();

// Health check endpoint
app.get("/health", (req, res) => {
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
app.listen(PORT, () => {
  logger.log("info", `System Settings API server running on port ${PORT}`);
});

export default app;
