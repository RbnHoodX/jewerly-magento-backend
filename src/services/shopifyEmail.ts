import { Logger } from "../utils/logger";
import { google } from "googleapis";
import { EmailLoggingService } from "./emailLoggingService";

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
  orderId?: string;
  customerId?: string;
  type?: string;
}

export class ShopifyEmailService {
  private logger: Logger;
  private emailLoggingService: EmailLoggingService;
  private googleClientId: string;
  private googleClientSecret: string;
  private googleRefreshToken: string;
  private gmailAddress: string;
  private oauth2Client: any;
  private isConfigured: boolean;
  private useGmail: boolean;

  constructor() {
    this.logger = new Logger("ShopifyEmailService");
    this.emailLoggingService = new EmailLoggingService();

    // Get credentials from environment variables
    this.googleClientId = process.env.GOOGLE_CLIENT_ID || "";
    this.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    this.googleRefreshToken = process.env.GOOGLE_REFRESH_TOKEN || "";
    this.gmailAddress = process.env.GMAIL_ADDRESS || "";

    this.isConfigured = true;
    this.useGmail = !!(this.googleClientId && this.googleClientSecret && this.googleRefreshToken && this.gmailAddress);

    // Set up OAuth2 client
    if (this.useGmail) {
      this.oauth2Client = new google.auth.OAuth2(
        this.googleClientId,
        this.googleClientSecret
      );
      this.oauth2Client.setCredentials({ refresh_token: this.googleRefreshToken });
    }

    // Log configuration status
    this.logger.log("info", "Email Service Configuration:", {
      gmailConfigured: this.useGmail,
      gmailAddress: this.gmailAddress,
    });

    if (!this.useGmail) {
      this.logger.log(
        "warn",
        "Gmail API not configured (set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GMAIL_ADDRESS). Using mock email sending."
      );
    }
  }

  /**
   * Send an email via Gmail API (only method)
   */
  async sendEmail(emailData: EmailData): Promise<string> {
    const startTime = Date.now();
    let emailId: string;
    let status: "sent" | "failed" | "pending" = "pending";
    let provider: "gmail" = "gmail";
    let errorMessage: string | undefined;

    try {
      // Log email attempt
      await this.emailLoggingService.logEmail({
        sent_at: new Date().toISOString(),
        recipient_email: emailData.to,
        subject: emailData.subject,
        status: "pending",
        order_id: emailData.orderId,
        email_type: emailData.type || "customer",
      });

      // Use only Gmail API for all email sending
      if (this.useGmail) {
        provider = "gmail";
        emailId = await this.sendEmailViaGmail(emailData);
      } else {
        // Return a mock email ID for testing purposes when no service is configured
        emailId = `mock_email_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        this.logger.log(
          "info",
          "Mock email sent (no Gmail API configured)",
          {
            emailId: emailId,
            to: emailData.to,
            subject: emailData.subject,
          }
        );
      }

      status = "sent";

      // Log successful email
      await this.emailLoggingService.logEmail({
        sent_at: new Date().toISOString(),
        recipient_email: emailData.to,
        subject: emailData.subject,
        status: "sent",
        order_id: emailData.orderId,
        email_type: emailData.type || "customer",
      });

      return emailId;
    } catch (error) {
      status = "failed";
      errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.log("error", "Failed to send email", {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      // Log failed email
      await this.emailLoggingService.logEmail({
        sent_at: new Date().toISOString(),
        recipient_email: emailData.to,
        subject: emailData.subject,
        status: "failed",
        error_message: errorMessage,
        order_id: emailData.orderId,
        email_type: emailData.type || "customer",
      });

      throw error;
    }
  }

  /**
   * Send email via Gmail API (only supported provider)
   */
  private async sendEmailViaGmail(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via Gmail API", {
      to: emailData.to,
      subject: emailData.subject,
      from: this.gmailAddress,
    });

    try {
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
      
      // Build raw message with proper HTML formatting
      const htmlBody = this.formatEmailBody(emailData.body || "");
      const raw = this.buildRawMessage({
        from: this.gmailAddress,
        to: emailData.to,
        subject: emailData.subject,
        html: htmlBody,
        replyTo: emailData.replyTo || this.gmailAddress,
      });

      // Send email via Gmail API
      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      const emailId = response.data.id || `gmail_api_${Date.now()}`;

      this.logger.log("info", "Email sent successfully via Gmail API", {
        emailId,
        to: emailData.to,
        subject: emailData.subject,
        messageId: response.data.id,
      });

      return emailId;
    } catch (error) {
      this.logger.log("error", "Failed to send email via Gmail API:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        to: emailData.to,
        subject: emailData.subject,
      });
      throw new Error(
        `Gmail API send failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Format email body with proper HTML structure
   */
  private formatEmailBody(body: string): string {
    if (!body || body.trim() === "") {
      return "<p>No message content.</p>";
    }

    // Convert plain text to HTML with proper formatting
    const htmlBody = body
      .replace(/\n\n/g, '</p><p>') // Double newlines become paragraph breaks
      .replace(/\n/g, '<br>')      // Single newlines become line breaks
      .replace(/^/, '<p>')          // Start with paragraph tag
      .replace(/$/, '</p>');        // End with paragraph tag

    return htmlBody;
  }

  /**
   * Helper to build raw message for Gmail API
   */
  private buildRawMessage({ from, to, subject, html, replyTo }: {
    from: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): string {
    // Encode subject for proper UTF-8 handling
    const encodedSubject = this.encodeSubject(subject);
    
    const message =
      `From: ${from}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${encodedSubject}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset=UTF-8\r\n` +
      (replyTo ? `Reply-To: ${replyTo}\r\n` : '') +
      `\r\n` +
      html;
    return Buffer.from(message).toString("base64url");
  }

  /**
   * Encode subject line for proper UTF-8 handling
   */
  private encodeSubject(subject: string): string {
    // Check if subject contains non-ASCII characters (like emojis)
    const hasNonAscii = /[^\x00-\x7F]/.test(subject);
    
    if (hasNonAscii) {
      // Use RFC 2047 encoding for non-ASCII characters
      return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    }
    
    return subject;
  }

  // All other providers removed to enforce Gmail-only sending.
}
