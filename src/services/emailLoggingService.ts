import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

export interface EmailLog {
  id?: string;
  sent_at: string;
  recipient_email: string;
  subject: string;
  status: "sent" | "failed" | "pending";
  email_type?: string;
  error_message?: string;
  order_id?: string;
  status_rule_id?: string;
  message?: string;
  shopify_email_id?: string;
  created_at?: string;
}

export class EmailLoggingService {
  private supabase: any;
  private logger: Logger;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.logger = new Logger("EmailLoggingService");
  }

  async logEmail(emailLog: Omit<EmailLog, "id" | "created_at">): Promise<void> {
    try {
      // Validate order_id is a valid UUID if provided
      const logData = { ...emailLog };
      if (logData.order_id && !this.isValidUUID(logData.order_id)) {
        this.logger.log("warn", "Invalid order_id format, setting to null", {
          order_id: logData.order_id,
        });
        logData.order_id = null;
      }

      // Ensure required fields are provided
      if (!logData.message) {
        logData.message = logData.subject || "No message content";
      }

      // Ensure email_type is valid
      if (
        !logData.email_type ||
        !["customer", "private", "private_copy", "additional", "test"].includes(
          logData.email_type
        )
      ) {
        logData.email_type = "customer";
      }

      const { data, error } = await this.supabase
        .from("email_logs")
        .insert([logData])
        .select()
        .single();

      if (error) {
        this.logger.log("error", "Failed to log email", {
          error: error.message,
          emailLog: logData,
        });
        throw error;
      }

      this.logger.log("info", "Email logged successfully", {
        id: data.id,
        recipient: emailLog.recipient_email,
        status: emailLog.status,
      });
    } catch (error) {
      this.logger.log("error", "Email logging failed", {
        error: error instanceof Error ? error.message : String(error),
        emailLog,
      });
      // Don't throw here - email logging shouldn't break email sending
    }
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  async getEmailLogs(limit: number = 50): Promise<EmailLog[]> {
    try {
      this.logger.log("info", "🔍 EmailLoggingService: Starting getEmailLogs", {
        limit,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        "info",
        "🔍 EmailLoggingService: Supabase client status",
        {
          supabaseUrl: process.env.SUPABASE_URL ? "✓" : "✗",
          supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ? "✓" : "✗",
          supabaseClient: this.supabase ? "✓" : "✗",
        }
      );

      this.logger.log(
        "info",
        "🔍 EmailLoggingService: Executing Supabase query",
        {
          table: "email_logs",
          operation: "select",
          orderBy: "timestamp DESC",
          limit: limit,
        }
      );

      const { data, error } = await this.supabase
        .from("email_logs")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(limit);

      this.logger.log(
        "info",
        "🔍 EmailLoggingService: Supabase query completed",
        {
          hasError: !!error,
          errorMessage: error ? error.message : null,
          dataLength: data ? data.length : 0,
          dataType: typeof data,
          dataIsArray: Array.isArray(data),
          rawData: data,
        }
      );

      if (error) {
        this.logger.log(
          "error",
          "🔍 EmailLoggingService: Supabase query failed",
          {
            error: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            errorHint: error.hint,
          }
        );
        throw error;
      }

      this.logger.log(
        "info",
        "🔍 EmailLoggingService: Query successful, processing data",
        {
          count: data ? data.length : 0,
          data: data,
          dataStringified: JSON.stringify(data, null, 2),
        }
      );

      // Only return real data from database, no fallback
      const result = data || [];

      this.logger.log("info", "🔍 EmailLoggingService: Returning result", {
        resultLength: result.length,
        resultType: typeof result,
        resultIsArray: Array.isArray(result),
        resultData: result,
      });

      return result;
    } catch (error) {
      this.logger.log("error", "🔍 EmailLoggingService: getEmailLogs failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: typeof error,
      });
      // Return empty array instead of any fallback data
      this.logger.log(
        "info",
        "🔍 EmailLoggingService: Returning empty array due to error"
      );
      return [];
    }
  }

  async getEmailLogsByStatus(
    status: string,
    limit: number = 50
  ): Promise<EmailLog[]> {
    try {
      const { data, error } = await this.supabase
        .from("email_logs")
        .select("*")
        .eq("status", status)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.log("error", "Failed to fetch email logs by status", {
          error: error.message,
          status,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.log("error", "Email logs by status fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        status,
      });
      return [];
    }
  }

  async getEmailLogsByProvider(
    provider: string,
    limit: number = 50
  ): Promise<EmailLog[]> {
    try {
      const { data, error } = await this.supabase
        .from("email_logs")
        .select("*")
        .eq("provider", provider)
        .order("timestamp", { ascending: false })
        .limit(limit);

      if (error) {
        this.logger.log("error", "Failed to fetch email logs by provider", {
          error: error.message,
          provider,
        });
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.log("error", "Email logs by provider fetch failed", {
        error: error instanceof Error ? error.message : String(error),
        provider,
      });
      return [];
    }
  }
}
