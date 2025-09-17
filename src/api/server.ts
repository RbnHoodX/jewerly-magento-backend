// Express server for system settings API

import express from "express";
import cors from "cors";
import { config } from "dotenv";
import { SystemSettingsService } from "../services/systemSettings";
import { SystemCronService } from "../services/systemCron";
import { Logger } from "../utils/logger";

// Load environment variables
config();

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

const app = express();
const logger = new Logger("SystemSettingsAPI");
const PORT = parseInt(process.env.PORT || process.env.API_PORT || "3003", 10);

// Log startup information
console.log("🚀 Starting Shopify Database Sync API Server");
console.log(`📦 Runtime: Bun ${process.version}`);
console.log(`🌐 Port: ${PORT}`);
console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);

// Initialize cron service
let cronService: SystemCronService | null = null;

// Initialize cron service asynchronously to prevent blocking
const initializeCronService = async () => {
  try {
    cronService = new SystemCronService();
    logger.log("info", "Cron service initialized successfully");
  } catch (error) {
    logger.log("error", "Failed to initialize cron service", { error });
    // Don't exit the process, just log the error and continue without cron
    console.warn("⚠️  Cron service failed to initialize, continuing without cron jobs");
  }
};

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - ${req.ip}`);
  console.log(`Request headers:`, JSON.stringify(req.headers, null, 2));
  next();
});

// Load settings on startup
SystemSettingsService.loadSettings();

// Start cron jobs if enabled (after cron service is initialized)
const startCronJobsIfEnabled = () => {
  if (cronService) {
    const settings = SystemSettingsService.getSettings();
    if (settings.syncEnabled || settings.automationEnabled) {
      cronService.start();
      logger.log("info", "Cron jobs started on server startup");
    }
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  console.log("🏥 Health check requested");
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Simple ping endpoint for basic connectivity test
app.get("/ping", (req, res) => {
  console.log("🏓 Ping requested");
  res.status(200).send("pong");
});

app.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Test endpoint working",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Debug endpoint
app.get("/debug", (req, res) => {
  res.json({
    status: "ok",
    message: "Debug endpoint working",
    timestamp: new Date().toISOString(),
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    request: {
      ip: req.ip,
      ips: req.ips,
      headers: req.headers,
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
    }
  });
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
    if (cronService) {
      cronService.restart();
      logger.log("info", "Settings updated and cron jobs restarted");
    } else {
      logger.log("warn", "Cron service not available, settings updated but cron jobs not restarted");
    }

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
    if (!cronService) {
      return res.json({
        success: false,
        message: "Cron service not available",
        data: null,
      });
    }
    
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
    if (!cronService) {
      return res.status(503).json({
        success: false,
        message: "Cron service not available",
      });
    }
    
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
    if (!cronService) {
      return res.status(503).json({
        success: false,
        message: "Cron service not available",
      });
    }
    
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
    if (!cronService) {
      return res.status(503).json({
        success: false,
        message: "Cron service not available",
      });
    }
    
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

// Catch-all route for unhandled requests
app.use("*", (req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(`Error handling ${req.method} ${req.path}:`, error);
    logger.log("error", "Unhandled error", { error, path: req.path, method: req.method });
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
);

// Graceful shutdown handler
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  if (cronService) {
    cronService.stop();
    console.log("Cron jobs stopped");
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const server = app.listen(PORT, "0.0.0.0", async () => {
  console.log("✅ Server started successfully!");
  console.log(`🌐 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🔒 CORS enabled for all origins`);
  console.log("🚀 Ready to accept requests!");
  console.log(`📡 Server bound to: 0.0.0.0:${PORT}`);
  console.log(`🌍 External access: http://[your-ip]:${PORT}/health`);

  logger.log("info", `System Settings API server running on port ${PORT}`);
  logger.log(
    "info",
    `Health check available at: http://localhost:${PORT}/health`
  );
  logger.log(
    "info",
    `Test endpoint available at: http://localhost:${PORT}/test`
  );
  logger.log("info", `CORS enabled for all origins`);

  // Test server is actually listening
  console.log("🧪 Testing server response...");
  try {
    const testResponse = await fetch(`http://localhost:${PORT}/health`);
    const testData = await testResponse.text();
    console.log(`✅ Server test successful: ${testResponse.status} - ${testData}`);
  } catch (error) {
    console.error(`❌ Server test failed:`, error);
  }

  // Initialize cron service asynchronously after server starts
  console.log("🔄 Initializing cron service...");
  await initializeCronService();
  startCronJobsIfEnabled();
  console.log("✅ Cron service initialization complete");
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Keep server alive and log periodic status
setInterval(() => {
  console.log(`🔄 Server status check - Port: ${PORT}, Uptime: ${Math.floor(process.uptime())}s`);
}, 30000); // Every 30 seconds

// Handle connection events
server.on('connection', (socket) => {
  console.log(`🔌 New connection from ${socket.remoteAddress}:${socket.remotePort}`);
});

server.on('listening', () => {
  console.log(`👂 Server is listening on port ${PORT}`);
});

export default app;
