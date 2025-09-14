export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    data?: any
  ): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(data && { data }),
    };

    // Console output with colors
    const colorMap = {
      info: "\x1b[36m", // Cyan
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
      debug: "\x1b[90m", // Gray
    };

    const resetColor = "\x1b[0m";
    const color = colorMap[level] || "";

    console.log(
      `${color}[${timestamp}] [${level.toUpperCase()}] [${
        this.context
      }] ${message}${resetColor}`
    );

    if (data) {
      console.log(
        `${color}Data: ${JSON.stringify(data, null, 2)}${resetColor}`
      );
    }
  }

  info(message: string, data?: any): void {
    this.log("info", message, data);
  }

  warn(message: string, data?: any): void {
    this.log("warn", message, data);
  }

  error(message: string, data?: any): void {
    this.log("error", message, data);
  }

  debug(message: string, data?: any): void {
    this.log("debug", message, data);
  }
}
