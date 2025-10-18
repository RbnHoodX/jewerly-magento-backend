// Google Sheets integration service for importing status models

import { google } from "googleapis";
import { Logger } from "../utils/logger";
import { parse } from "csv-parse/sync";

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

export class GoogleSheetsService {
  private logger: Logger;
  private sheets: any;

  constructor() {
    this.logger = new Logger("GoogleSheetsService");
    this.initializeSheets();
  }

  private initializeSheets() {
    try {
      // Get API key from environment variables
      const apiKey = process.env.GOOGLE_API_KEY;

      if (!apiKey || apiKey === "your_google_api_key_here") {
        this.logger.log(
          "warn",
          "Google API key not configured, using public access"
        );
        // For public sheets, we can use a simple fetch approach
        this.sheets = null;
        return;
      }

      // Initialize Google Sheets API with API key
      const auth = new google.auth.GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      this.sheets = google.sheets({ version: "v4", auth });
      this.logger.log("info", "Google Sheets API initialized with API key");
    } catch (error) {
      this.logger.log("error", "Failed to initialize Google Sheets API", {
        error,
      });
    }
  }

  /**
   * Extract spreadsheet ID from Google Sheets URL
   */
  static extractSpreadsheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Import status model from Google Sheets
   */
  async importStatusModel(
    url: string,
    range: string = "A1:H1000"
  ): Promise<{ success: boolean; data?: StatusModelRow[]; error?: string }> {
    try {
      const spreadsheetId = GoogleSheetsService.extractSpreadsheetId(url);
      if (!spreadsheetId) {
        throw new Error("Invalid Google Sheets URL");
      }

      this.logger.log("info", "Fetching data from Google Sheets", {
        spreadsheetId,
        range,
      });

      let rows: any[][];

      if (this.sheets) {
        // Use Google Sheets API with authentication
        const response = await this.sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        rows = response.data.values || [];
      } else {
        // Use public CSV export for public sheets
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0`;
        this.logger.log("info", "Using public CSV export", { csvUrl });

        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch CSV: ${response.status} ${response.statusText}`
          );
        }

        const csvText = await response.text();
        rows = await this.parseCSVWithLibrary(csvText);
      }

      if (rows.length < 2) {
        throw new Error("No data found in the specified range");
      }

      this.logger.log("info", "Data fetched from Google Sheets", {
        rowCount: rows.length,
      });

      // Skip header row and parse data
      const columnMapping = GoogleSheetsService.getColumnMapping();
      const statusModelData: StatusModelRow[] = rows
        .slice(1)
        .map((row: any[], index: number) => {
          // Handle "Instant" wait time
          let waitTime = 0;
          const waitTimeValue = row[columnMapping.wait_time];
          if (waitTimeValue && waitTimeValue.toLowerCase() !== "instant") {
            waitTime = parseInt(waitTimeValue) || 0;
          }

          // Clean up email custom message - handle template variables
          let emailCustomMessage =
            row[columnMapping.email_custom_message] || null;
          if (emailCustomMessage) {
            emailCustomMessage = emailCustomMessage
              .replace(/^"|"$/g, "") // Remove leading/trailing quotes
              .replace(/\\n/g, "\n") // Convert \n to actual newlines
              .trim();

            // Validate template variables
            this.validateEmailTemplate(emailCustomMessage);
          }

          return {
            status: (row[columnMapping.status] || "").trim(),
            new_status: (row[columnMapping.new_status] || "").trim(),
            wait_time_business_days: waitTime,
            description: (row[columnMapping.description] || "").trim(),
            private_email: row[columnMapping.private_email]
              ? (row[columnMapping.private_email] || "").trim()
              : null,
            email_subject: row[columnMapping.email_subject]
              ? (row[columnMapping.email_subject] || "").trim()
              : null,
            email_custom_message: emailCustomMessage,
            additional_recipients: row[columnMapping.additional_recipients]
              ? row[columnMapping.additional_recipients]
                  .split(",")
                  .map((email: any) => email.trim())
                  .filter((email: any) => email)
              : [],
            is_active: true,
          };
        })
        .filter((row: StatusModelRow) => row.status && row.new_status);

      this.logger.log("info", "Status model data parsed", {
        validRows: statusModelData.length,
        totalRows: rows.length - 1,
      });

      return {
        success: true,
        data: statusModelData,
      };
    } catch (error) {
      this.logger.log("error", "Google Sheets import error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse CSV text using csv-parse library for accurate multi-line parsing
   */
  private async parseCSVWithLibrary(csvText: string): Promise<any[][]> {
    try {
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        quote: '"',
        escape: '"',
        delimiter: ",",
        relax_column_count: true,
      });

      const rows: any[][] = [];

      // Add header row
      const headerRow = [
        "Status",
        "New Status",
        "Wait Time ( in business days)",
        "Description",
        "Private",
        "Email Subject",
        "Email Custom Message",
        "Additional Recipients",
      ];
      rows.push(headerRow);

      // Convert each data row to array format
      records.forEach((row: any) => {
        // Only process rows that have a valid Status field (not empty or undefined)
        if (row["Status"] && row["Status"].trim()) {
          const rowArray = [
            row["Status"] || "",
            row["New Status"] || "",
            row["Wait Time ( in business days)"] || "",
            row["Description"] || "",
            row["Private"] || "",
            row["Email Subject"] || "",
            row["Email Custom Message"] || "",
            row["Additional Recipients"] || "",
          ];
          rows.push(rowArray);
        }
      });

      return rows;
    } catch (error) {
      throw new Error(
        `CSV parsing failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Validate Google Sheets URL format
   */
  static validateUrl(url: string): { valid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);

      if (!urlObj.hostname.includes("docs.google.com")) {
        return {
          valid: false,
          error: "URL must be from Google Sheets (docs.google.com)",
        };
      }

      if (!url.includes("/spreadsheets/d/")) {
        return {
          valid: false,
          error: "URL must be a Google Sheets URL",
        };
      }

      const spreadsheetId = this.extractSpreadsheetId(url);
      if (!spreadsheetId) {
        return {
          valid: false,
          error: "Could not extract spreadsheet ID from URL",
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: "Invalid URL format",
      };
    }
  }

  /**
   * Validate email template variables
   */
  private validateEmailTemplate(template: string): void {
    const validVariables = [
      "{{ customer_name }}",
      "{{ order_name }}",
      "{{ order_summary }}",
    ];
    const templateVariables = template.match(/\{\{\s*\w+\s*\}\}/g) || [];

    const invalidVariables = templateVariables.filter(
      (variable) => !validVariables.includes(variable)
    );

    if (invalidVariables.length > 0) {
      this.logger.log("warn", "Invalid template variables found", {
        invalidVariables,
        validVariables,
        template: template.substring(0, 200) + "...",
      });
    }
  }

  /**
   * Process email template with order data
   */
  static processEmailTemplate(
    template: string,
    orderData: {
      customer_name: string;
      order_name: string;
      order_summary: string;
    }
  ): string {
    return template
      .replace(/\{\{\s*customer_name\s*\}\}/g, orderData.customer_name || "")
      .replace(/\{\{\s*order_name\s*\}\}/g, orderData.order_name || "")
      .replace(/\{\{\s*order_summary\s*\}\}/g, orderData.order_summary || "");
  }

  /**
   * Extract customer name from order data
   * This method handles different sources of customer names
   */
  static extractCustomerName(orderData: {
    bill_to_name?: string | null;
    billing_address?: {
      first_name?: string;
      last_name?: string;
    };
  }): string {
    // First try to get from bill_to_name field
    if (orderData.bill_to_name) {
      return orderData.bill_to_name.trim();
    }

    // Then try to get from billing address
    if (orderData.billing_address) {
      const firstName = orderData.billing_address.first_name || "";
      const lastName = orderData.billing_address.last_name || "";
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        return fullName;
      }
    }

    // Fallback to generic name
    return "Valued Customer";
  }

  /**
   * Get expected column headers for status model
   */
  static getExpectedHeaders(): string[] {
    return [
      "Status",
      "New Status",
      "Wait Time ( in business days)",
      "Description",
      "Private",
      "Email Subject",
      "Email Custom Message",
      "Additional Recipients",
    ];
  }

  /**
   * Get column mapping for the new Google Sheet format
   */
  static getColumnMapping(): Record<string, number> {
    return {
      status: 0,
      new_status: 1,
      wait_time: 2,
      description: 3,
      private_email: 4,
      email_subject: 5,
      email_custom_message: 6,
      additional_recipients: 7,
    };
  }
}
