import { Logger } from "../utils/logger";
import nodemailer from "nodemailer";
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
  private gmailUser: string;
  private gmailPassword: string;
  private fromEmail: string;
  private isConfigured: boolean;
  private useGmail: boolean;

  constructor() {
    this.logger = new Logger("ShopifyEmailService");
    this.emailLoggingService = new EmailLoggingService();

    // Get credentials from environment variables
    this.gmailUser = process.env.GMAIL_USER || "";
    this.gmailPassword = process.env.GMAIL_APP_PASSWORD || "";
    this.fromEmail = process.env.FROM_EMAIL || this.gmailUser || "";

    this.isConfigured = true;
    this.useGmail = !!(this.gmailUser && this.gmailPassword);

    // Log configuration status
    this.logger.log("info", "Email Service Configuration:", {
      gmailConfigured: this.useGmail,
      fromEmail: this.fromEmail,
    });

    if (!this.useGmail) {
      this.logger.log(
        "warn",
        "Gmail SMTP not configured (set GMAIL_USER, GMAIL_APP_PASSWORD, FROM_EMAIL). Using mock email sending."
      );
    }
  }

  /**
   * Send an email via Gmail SMTP (only method)
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

      // Use only Gmail SMTP for all email sending
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
          "Mock email sent (no Gmail SMTP configured)",
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
   * Send email via Gmail SMTP (only supported provider)
   */
  private async sendEmailViaGmail(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via Gmail SMTP", {
      to: emailData.to,
      subject: emailData.subject,
      from: this.fromEmail,
    });

    // Create transporter with explicit Gmail SMTP settings
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: this.gmailUser,
        pass: this.gmailPassword,
      },
    });

    // Verify connection configuration
    try {
      await transporter.verify();
      this.logger.log("info", "Gmail SMTP connection verified successfully");
    } catch (error) {
      this.logger.log("error", "Gmail SMTP connection verification failed:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });
      throw new Error(
        `Gmail SMTP connection failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }

    const mailOptions = {
      from: `"PrimeStyle Jewelry" <${this.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.body || "",
      html: (emailData.body || "").replace(/\n/g, "<br>"),
      replyTo: emailData.replyTo || this.fromEmail,
    };

    try {
      const info = await transporter.sendMail(mailOptions);
      const emailId = info.messageId || `gmail_${Date.now()}`;

      this.logger.log("info", "Email sent successfully via Gmail SMTP", {
        emailId,
        to: emailData.to,
        subject: emailData.subject,
        messageId: info.messageId,
      });

      return emailId;
    } catch (error) {
      this.logger.log("error", "Failed to send email via Gmail SMTP:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        to: emailData.to,
        subject: emailData.subject,
      });
      throw new Error(
        `Gmail SMTP send failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  // All other providers removed to enforce Gmail-only sending.
}
