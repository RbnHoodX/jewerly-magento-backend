// Service for managing status model data in Supabase

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";
import { config } from "dotenv";

// Load environment variables
config();

export interface StatusModelRow {
  status: string;
  new_status: string;
  wait_time_business_days: number;
  description: string;
  private_email?: string;
  email_subject?: string;
  email_custom_message?: string;
  additional_recipients?: string[];
  is_active: boolean;
}

export class StatusModelService {
  private logger: Logger;
  private supabase: any;

  constructor() {
    this.logger = new Logger("StatusModelService");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase configuration missing");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Clear existing status model data
   */
  async clearExistingData(): Promise<void> {
    try {
      this.logger.log("info", "Clearing existing status model data");

      const { error } = await this.supabase
        .from("statuses_model")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

      if (error) {
        throw error;
      }

      this.logger.log("info", "Existing status model data cleared");
    } catch (error) {
      this.logger.log("error", "Failed to clear existing data", { error });
      throw error;
    }
  }

  /**
   * Insert status model data into Supabase
   */
  async insertStatusModelData(data: StatusModelRow[]): Promise<void> {
    try {
      this.logger.log("info", "Inserting status model data into Supabase", {
        recordCount: data.length,
      });

      // Prepare data for insertion
      const insertData = data.map((row) => ({
        status: row.status,
        new_status: row.new_status,
        wait_time_business_days: row.wait_time_business_days,
        description: row.description,
        private_email: row.private_email,
        email_subject: row.email_subject,
        email_custom_message: row.email_custom_message,
        additional_recipients: row.additional_recipients || [],
        is_active: row.is_active,
      }));

      const { error } = await this.supabase
        .from("statuses_model")
        .insert(insertData);

      if (error) {
        throw error;
      }

      this.logger.log("info", "Status model data inserted successfully", {
        recordCount: data.length,
      });
    } catch (error) {
      this.logger.log("error", "Failed to insert status model data", { error });
      throw error;
    }
  }

  /**
   * Get current status model data from Supabase
   */
  async getCurrentData(): Promise<StatusModelRow[]> {
    try {
      const { data, error } = await this.supabase
        .from("statuses_model")
        .select("*")
        .eq("is_active", true)
        .order("status");

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      this.logger.log("error", "Failed to get current status model data", {
        error,
      });
      throw error;
    }
  }

  /**
   * Import and replace status model data
   */
  async importAndReplaceData(data: StatusModelRow[]): Promise<void> {
    try {
      this.logger.log("info", "Starting status model data import and replace");

      // Clear existing data
      await this.clearExistingData();

      // Insert new data
      await this.insertStatusModelData(data);

      this.logger.log(
        "info",
        "Status model data import and replace completed successfully"
      );
    } catch (error) {
      this.logger.log(
        "error",
        "Failed to import and replace status model data",
        { error }
      );
      throw error;
    }
  }
}
