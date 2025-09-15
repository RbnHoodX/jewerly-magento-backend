// Google Sheets integration service for importing status models

import { google } from "googleapis";
import { Logger } from "../utils/logger";
import csv from "csv-parser";
import { Readable } from "stream";

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
    range: string = "A1:H100"
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
      const statusModelData: StatusModelRow[] = rows
        .slice(1)
        .map((row: any[], index: number) => {
          // Handle "Instant" wait time
          let waitTime = 0;
          if (row[2] && row[2].toLowerCase() !== "instant") {
            waitTime = parseInt(row[2]) || 0;
          }

          // Clean up email custom message - remove extra quotes and newlines
          let emailCustomMessage = row[6] || null;
          if (emailCustomMessage) {
            emailCustomMessage = emailCustomMessage
              .replace(/^"|"$/g, "") // Remove leading/trailing quotes
              .replace(/\\n/g, "\n") // Convert \n to actual newlines
              .trim();
          }

          return {
            status: (row[0] || "").trim(),
            new_status: (row[1] || "").trim(),
            wait_time_business_days: waitTime,
            description: (row[3] || "").trim(),
            private_email: row[4] ? (row[4] || "").trim() : null,
            email_subject: row[5] ? (row[5] || "").trim() : null,
            email_custom_message: emailCustomMessage,
            additional_recipients: row[7]
              ? row[7]
                  .split(",")
                  .map((email: string) => email.trim())
                  .filter((email) => email)
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
   * Parse CSV text into rows using a robust parser for malformed CSV
   */
  private async parseCSVWithLibrary(csvText: string): Promise<any[][]> {
    const lines = csvText.split("\n");
    const rows: any[][] = [];

    // Get header row
    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);
    rows.push(headers);

    // Known status names to identify data rows
    const knownStatuses = [
      "Casting Order",
      "Casting Received",
      "Polishing & Finishing",
      "Return For Refund Instructions",
      "Return for replacement instructions",
      "Return For Refund Received",
      "Return for replacement received",
      "Item Shipped",
      "Casting Order Email Sent",
      "Casting Order Delay - Jenny",
    ];

    // Find and parse data rows using a more sophisticated approach
    let i = 1;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // Check if this line starts with a known status
      for (const status of knownStatuses) {
        if (line.startsWith(status + ",")) {
          // This is a data row, parse it with multi-line handling
          const { rowData, nextIndex } = this.parseDataRowWithMultiLine(
            lines,
            i,
            knownStatuses
          );
          if (rowData) {
            rows.push(rowData);
          }
          i = nextIndex;
          break;
        }
      }
      i++;
    }

    return rows;
  }

  /**
   * Parse a data row with proper multi-line handling
   */
  private parseDataRowWithMultiLine(
    allLines: string[],
    startIndex: number,
    knownStatuses: string[]
  ): { rowData: string[] | null; nextIndex: number } {
    try {
      const startLine = allLines[startIndex];
      const initialFields = startLine.split(",");

      // Expected fields: Status, New Status, Wait Time, Description, Private Email, Email Subject, Email Custom Message, Additional Recipients
      const row = new Array(8).fill("");

      // Fill in the fields we can get from the first line
      row[0] = initialFields[0] || ""; // Status
      row[1] = initialFields[1] || ""; // New Status
      row[2] = initialFields[2] || ""; // Wait Time
      row[3] = initialFields[3] || ""; // Description
      row[4] = initialFields[4] || ""; // Private Email
      row[5] = initialFields[5] || ""; // Email Subject

      // Handle Email Custom Message and Additional Recipients
      let emailCustomMessage = "";
      let additionalRecipients = "";

      // Check if we have more fields in the first line
      if (initialFields.length > 6) {
        emailCustomMessage = initialFields[6] || "";
        if (initialFields.length > 7) {
          additionalRecipients = initialFields[7] || "";
        }
      }

      // Look for multi-line content in subsequent lines
      let currentIndex = startIndex + 1;
      let inEmailMessage = false;
      let inAdditionalRecipients = false;

      while (currentIndex < allLines.length) {
        const nextLine = allLines[currentIndex].trim();

        if (!nextLine) {
          currentIndex++;
          continue;
        }

        // Check if this is the start of another data row
        const isNextDataRow = knownStatuses.some((status) =>
          nextLine.startsWith(status + ",")
        );
        if (isNextDataRow) {
          break;
        }

        // This is part of the current row's multi-line content
        if (!inEmailMessage && !inAdditionalRecipients) {
          // This is likely part of the email custom message
          emailCustomMessage += (emailCustomMessage ? "\n" : "") + nextLine;
          inEmailMessage = true;
        } else if (inEmailMessage && !inAdditionalRecipients) {
          // Check if this looks like additional recipients (has email-like content)
          if (
            nextLine.includes("@") ||
            nextLine.includes("email") ||
            nextLine.includes("recipient")
          ) {
            additionalRecipients = nextLine;
            inAdditionalRecipients = true;
          } else {
            emailCustomMessage += "\n" + nextLine;
          }
        } else {
          additionalRecipients += "\n" + nextLine;
        }

        currentIndex++;
      }

      row[6] = emailCustomMessage.trim();
      row[7] = additionalRecipients.trim();

      return { rowData: row, nextIndex: currentIndex };
    } catch (error) {
      console.error("Error parsing data row:", error);
      return { rowData: null, nextIndex: startIndex + 1 };
    }
  }

  /**
   * Parse a single data row, handling multi-line content
   */
  private parseDataRow(
    startLine: string,
    allLines: string[],
    startIndex: number
  ): string[] | null {
    try {
      // Split the first line to get initial fields
      const initialFields = startLine.split(",");

      // Expected fields: Status, New Status, Wait Time, Description, Private Email, Email Subject, Email Custom Message, Additional Recipients
      const row = new Array(8).fill("");

      // Fill in the fields we can get from the first line
      row[0] = initialFields[0] || ""; // Status
      row[1] = initialFields[1] || ""; // New Status
      row[2] = initialFields[2] || ""; // Wait Time
      row[3] = initialFields[3] || ""; // Description
      row[4] = initialFields[4] || ""; // Private Email
      row[5] = initialFields[5] || ""; // Email Subject

      // Handle Email Custom Message and Additional Recipients
      let emailCustomMessage = "";
      let additionalRecipients = "";

      // Look for the rest of the content in subsequent lines
      let currentIndex = startIndex + 1;
      let inEmailMessage = false;
      let inAdditionalRecipients = false;

      // Check if we have more fields in the first line
      if (initialFields.length > 6) {
        emailCustomMessage = initialFields[6] || "";
        if (initialFields.length > 7) {
          additionalRecipients = initialFields[7] || "";
        }
      }

      // Look for multi-line content in subsequent lines
      while (currentIndex < allLines.length) {
        const nextLine = allLines[currentIndex].trim();

        if (!nextLine) {
          currentIndex++;
          continue;
        }

        // Check if this is the start of another data row
        const isNextDataRow = knownStatuses.some((status) =>
          nextLine.startsWith(status + ",")
        );
        if (isNextDataRow) {
          break;
        }

        // This is part of the current row's multi-line content
        if (!inEmailMessage && !inAdditionalRecipients) {
          // This is likely part of the email custom message
          emailCustomMessage += (emailCustomMessage ? "\n" : "") + nextLine;
          inEmailMessage = true;
        } else if (inEmailMessage && !inAdditionalRecipients) {
          // Check if this looks like additional recipients (has email-like content)
          if (
            nextLine.includes("@") ||
            nextLine.includes("email") ||
            nextLine.includes("recipient")
          ) {
            additionalRecipients = nextLine;
            inAdditionalRecipients = true;
          } else {
            emailCustomMessage += "\n" + nextLine;
          }
        } else {
          additionalRecipients += "\n" + nextLine;
        }

        currentIndex++;
      }

      row[6] = emailCustomMessage.trim();
      row[7] = additionalRecipients.trim();

      return row;
    } catch (error) {
      console.error("Error parsing data row:", error);
      return null;
    }
  }

  /**
   * Parse a single CSV line
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
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
   * Get expected column headers for status model
   */
  static getExpectedHeaders(): string[] {
    return [
      "Status",
      "New Status",
      "Wait Time (Business Days)",
      "Description",
      "Private Email",
      "Email Subject",
      "Email Custom Message",
      "Additional Recipients",
    ];
  }
}
