import { Logger } from "../utils/logger";
import { Resend } from "resend";
import sgMail from "@sendgrid/mail";
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
  private shopifyAccessToken: string;
  private shopifyShopDomain: string;
  private sendGridApiKey: string;
  private resendApiKey: string;
  private gmailUser: string;
  private gmailPassword: string;
  private fromEmail: string;
  private isConfigured: boolean;
  private useSendGrid: boolean;
  private useResend: boolean;
  private useGmail: boolean;
  private resend: Resend | null = null;

  constructor() {
    this.logger = new Logger("ShopifyEmailService");
    this.emailLoggingService = new EmailLoggingService();

    // Get credentials from environment variables
    this.shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    this.shopifyShopDomain = process.env.SHOPIFY_SHOP_DOMAIN || "";
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || "";
    this.resendApiKey = process.env.RESEND_API_KEY || "";
    this.gmailUser = process.env.GMAIL_USER || "";
    this.gmailPassword = process.env.GMAIL_APP_PASSWORD || "";
    this.fromEmail = process.env.FROM_EMAIL || "onboarding@resend.dev";

    this.isConfigured = !!(this.shopifyAccessToken && this.shopifyShopDomain);
    this.useSendGrid = !!(
      this.sendGridApiKey &&
      this.sendGridApiKey !== "your_api_key_here" &&
      this.sendGridApiKey.startsWith("SG.")
    );
    this.useResend = !!(
      this.resendApiKey &&
      this.resendApiKey.startsWith("re_")
    );
    this.useGmail = !!(this.gmailUser && this.gmailPassword);

    // Use only Resend for all email sending
    this.useSendGrid = false;
    this.useGmail = false;
    this.isConfigured = false;

    // Initialize Resend if configured
    if (this.useResend) {
      this.resend = new Resend(this.resendApiKey);
    }

    // Log configuration status
    this.logger.log("info", "Email Service Configuration:", {
      resendConfigured: this.useResend,
      fromEmail: this.fromEmail,
    });

    if (this.useResend) {
      this.logger.log("info", "Resend configured for email sending");
    } else {
      this.logger.log(
        "warn",
        "No email service configured. Using mock email sending."
      );
    }
  }

  /**
   * Send an email via Resend, SendGrid, Gmail or Shopify API
   */
  async sendEmail(emailData: EmailData): Promise<string> {
    const startTime = Date.now();
    let emailId: string;
    let status: "sent" | "failed" | "pending" = "pending";
    let provider: "resend" | "gmail" | "sendgrid" | "shopify" = "resend";
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

      // Use only Resend for all email sending
      if (this.useResend) {
        provider = "resend";
        emailId = await this.sendEmailViaResend(emailData);
      } else {
        // Return a mock email ID for testing purposes when no service is configured
        emailId = `mock_email_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        this.logger.log(
          "info",
          "Mock email sent (no email service configured)",
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
   * Send email via Resend
   */
  private async sendEmailViaResend(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via Resend", {
      to: emailData.to,
      subject: emailData.subject,
      from: this.fromEmail,
    });

    if (!this.resend) {
      throw new Error("Resend is not configured");
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: emailData.from || this.fromEmail,
        to: [emailData.to],
        subject: emailData.subject,
        html: (emailData.body || "").replace(/\n/g, "<br>"),
        replyTo: emailData.replyTo || this.fromEmail,
      });

      if (error) {
        this.logger.log("error", "Failed to send email via Resend:", error);
        throw new Error(`Resend send failed: ${error.message}`);
      }

      const emailId = data?.id || `resend_${Date.now()}`;

      this.logger.log("info", "Email sent successfully via Resend", {
        emailId,
        to: emailData.to,
        subject: emailData.subject,
      });

      return emailId;
    } catch (error) {
      this.logger.log("error", "Failed to send email via Resend:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        to: emailData.to,
        subject: emailData.subject,
      });
      throw new Error(
        `Resend send failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Send email via Gmail SMTP
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

  /**
   * Send email via SendGrid
   */
  private async sendEmailViaSendGrid(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via SendGrid", {
      to: emailData.to,
      subject: emailData.subject,
    });

    const msg = {
      to: emailData.to,
      from: emailData.from || this.fromEmail,
      subject: emailData.subject,
      text: emailData.body || "",
      html: (emailData.body || "").replace(/\n/g, "<br>"),
      replyTo: emailData.replyTo || this.fromEmail,
    };

    try {
      const [response] = await sgMail.send(msg);
      const emailId = response.headers["x-message-id"] || `sendgrid_${Date.now()}`;

      this.logger.log("info", "Email sent successfully via SendGrid", {
        emailId,
        to: emailData.to,
        subject: emailData.subject,
      });

      return emailId;
    } catch (error) {
      this.logger.log("error", "Failed to send email via SendGrid:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        to: emailData.to,
        subject: emailData.subject,
      });
      throw new Error(
        `SendGrid send failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Send email via Shopify API
   */
  private async sendEmailViaShopifyAPI(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via Shopify API", {
      to: emailData.to,
      subject: emailData.subject,
    });

    const shopifyApiUrl = `https://${this.shopifyShopDomain}/admin/api/2023-10/emails.json`;

    const emailPayload = {
      email: {
        to: emailData.to,
        from: emailData.from || this.fromEmail,
        subject: emailData.subject,
        body: emailData.body,
      },
    };

    try {
      const response = await fetch(shopifyApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.shopifyAccessToken,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.statusText}`);
      }

      const result = await response.json();
      const emailId = result.email?.id || `shopify_${Date.now()}`;

      this.logger.log("info", "Email sent successfully via Shopify API", {
        emailId,
        to: emailData.to,
        subject: emailData.subject,
      });

      return emailId;
    } catch (error) {
      this.logger.log("error", "Failed to send email via Shopify API:", {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
        to: emailData.to,
        subject: emailData.subject,
      });
      throw new Error(
        `Shopify API send failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}
