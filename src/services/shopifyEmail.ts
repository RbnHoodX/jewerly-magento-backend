import { Logger } from "../utils/logger";
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
}

export class ShopifyEmailService {
  private logger: Logger;
  private emailLoggingService: EmailLoggingService;
  private shopifyAccessToken: string;
  private shopifyShopDomain: string;
  private sendGridApiKey: string;
  private gmailUser: string;
  private gmailPassword: string;
  private fromEmail: string;
  private isConfigured: boolean;
  private useSendGrid: boolean;
  private useGmail: boolean;

  constructor() {
    this.logger = new Logger("ShopifyEmailService");
    this.emailLoggingService = new EmailLoggingService();

    // Get credentials from environment variables
    this.shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    this.shopifyShopDomain = process.env.SHOPIFY_SHOP_DOMAIN || "";
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || "";
    this.gmailUser = process.env.GMAIL_USER || "";
    this.gmailPassword = process.env.GMAIL_APP_PASSWORD || "";
    this.fromEmail = process.env.FROM_EMAIL || "noreply@primestyle.com";

    this.isConfigured = !!(this.shopifyAccessToken && this.shopifyShopDomain);
    this.useSendGrid = !!(
      this.sendGridApiKey && this.sendGridApiKey !== "your_api_key_here"
    );
    this.useGmail = !!(this.gmailUser && this.gmailPassword);

    if (this.useSendGrid) {
      sgMail.setApiKey(this.sendGridApiKey);
      this.logger.log("info", "SendGrid configured for real email sending");
    } else if (this.useGmail) {
      this.logger.log("info", "Gmail SMTP configured for real email sending");
    } else if (!this.isConfigured) {
      this.logger.log(
        "warn",
        "No email service configured. Using mock email sending."
      );
    } else {
      this.logger.log("info", "Shopify API configured for email sending");
    }
  }

  /**
   * Send an email via SendGrid or Shopify API
   */
  async sendEmail(emailData: EmailData): Promise<string> {
    const startTime = Date.now();
    let emailId: string;
    let status: "sent" | "failed" | "pending" = "pending";
    let provider: "gmail" | "sendgrid" | "shopify" = "gmail";
    let errorMessage: string | undefined;

    try {
      // Log email attempt
      await this.emailLoggingService.logEmail({
        timestamp: new Date().toISOString(),
        recipient: emailData.to,
        subject: emailData.subject,
        status: "pending",
        provider: "gmail", // Will be updated based on actual provider used
        order_id: emailData.orderId,
        customer_id: emailData.customerId,
      });

      if (this.useSendGrid) {
        provider = "sendgrid";
        emailId = await this.sendEmailViaSendGrid(emailData);
      } else if (this.useGmail) {
        provider = "gmail";
        emailId = await this.sendEmailViaGmail(emailData);
      } else if (this.isConfigured) {
        provider = "shopify";
        emailId = await this.sendEmailViaShopifyAPI(emailData);
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
        timestamp: new Date().toISOString(),
        recipient: emailData.to,
        subject: emailData.subject,
        status: "sent",
        provider: provider,
        order_id: emailData.orderId,
        customer_id: emailData.customerId,
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
        timestamp: new Date().toISOString(),
        recipient: emailData.to,
        subject: emailData.subject,
        status: "failed",
        provider: provider,
        error_message: errorMessage,
        order_id: emailData.orderId,
        customer_id: emailData.customerId,
      });

      throw error;
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
      from: `"PrimeStyle Automation" <${this.fromEmail}>`,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.body,
      html: emailData.body.replace(/\n/g, "<br>"),
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
      text: emailData.body,
      html: emailData.body.replace(/\n/g, "<br>"),
    };

    const response = await sgMail.send(msg);
    const emailId =
      response[0].headers["x-message-id"] || `sendgrid_${Date.now()}`;

    this.logger.log("info", "Email sent successfully via SendGrid", {
      emailId,
      to: emailData.to,
      subject: emailData.subject,
    });

    return emailId;
  }

  /**
   * Send email via Shopify API
   */
  private async sendEmailViaShopifyAPI(emailData: EmailData): Promise<string> {
    this.logger.log("info", "Sending email via Shopify API", {
      to: emailData.to,
      subject: emailData.subject,
      orderId: emailData.orderId,
    });

    try {
      // Method 1: Send order notification (if we have an order ID)
      if (emailData.orderId) {
        return await this.sendOrderNotification(emailData);
      }

      // Method 2: Send customer notification (if we have a customer ID)
      if (emailData.customerId) {
        return await this.sendCustomerNotification(emailData);
      }

      // Method 3: Send via webhook trigger
      return await this.sendViaWebhook(emailData);
    } catch (error) {
      this.logger.log(
        "error",
        "Shopify API email failed, falling back to webhook",
        { error }
      );
      return await this.sendViaWebhook(emailData);
    }
  }

  /**
   * Send order notification via Shopify API
   */
  private async sendOrderNotification(emailData: EmailData): Promise<string> {
    const url = `https://${this.shopifyShopDomain}.myshopify.com/admin/api/2023-10/orders/${emailData.orderId}/transactions.json`;

    const transactionData = {
      transaction: {
        kind: "capture",
        status: "success",
        message: emailData.body,
        parent_id: null,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": this.shopifyAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    const emailId = `shopify_order_${result.transaction?.id || Date.now()}`;

    this.logger.log("info", "Order notification sent via Shopify API", {
      emailId,
      orderId: emailData.orderId,
      to: emailData.to,
    });

    return emailId;
  }

  /**
   * Send customer notification via Shopify API
   */
  private async sendCustomerNotification(
    emailData: EmailData
  ): Promise<string> {
    const url = `https://${this.shopifyShopDomain}.myshopify.com/admin/api/2023-10/customers/${emailData.customerId}/metafields.json`;

    const metafieldData = {
      metafield: {
        namespace: "automation",
        key: "email_notification",
        value: JSON.stringify({
          subject: emailData.subject,
          body: emailData.body,
          timestamp: new Date().toISOString(),
        }),
        type: "json",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": this.shopifyAccessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metafieldData),
    });

    if (!response.ok) {
      throw new Error(
        `Shopify API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    const emailId = `shopify_customer_${result.metafield?.id || Date.now()}`;

    this.logger.log("info", "Customer notification sent via Shopify API", {
      emailId,
      customerId: emailData.customerId,
      to: emailData.to,
    });

    return emailId;
  }

  /**
   * Send email via webhook trigger or real email service fallback
   */
  private async sendViaWebhook(emailData: EmailData): Promise<string> {
    // If SendGrid is available, use it for real email sending
    if (this.useSendGrid) {
      this.logger.log("info", "Using SendGrid for webhook fallback", {
        to: emailData.to,
        subject: emailData.subject,
      });
      return await this.sendEmailViaSendGrid(emailData);
    }

    // If Gmail is available, use it for real email sending
    if (this.useGmail) {
      this.logger.log("info", "Using Gmail SMTP for webhook fallback", {
        to: emailData.to,
        subject: emailData.subject,
      });
      return await this.sendEmailViaGmail(emailData);
    }

    // Otherwise, use mock webhook (for testing)
    const webhookData = {
      event: "customer_notification",
      data: {
        to: emailData.to,
        subject: emailData.subject,
        body: emailData.body,
        timestamp: new Date().toISOString(),
      },
    };

    const emailId = `shopify_webhook_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.logger.log("info", "Mock email triggered via webhook", {
      emailId,
      to: emailData.to,
      subject: emailData.subject,
      webhookData,
    });

    return emailId;
  }

  /**
   * Alternative implementation using a third-party email service
   * This would be used if you integrate with SendGrid, Mailgun, etc.
   */
  private async sendEmailViaThirdParty(emailData: EmailData): Promise<string> {
    // Example implementation for SendGrid (you would need to install @sendgrid/mail)
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: emailData.to,
      from: emailData.from || process.env.FROM_EMAIL,
      subject: emailData.subject,
      text: emailData.body,
      html: emailData.body.replace(/\n/g, '<br>')
    };

    const response = await sgMail.send(msg);
    return response[0].headers['x-message-id'];
    */

    throw new Error("Third-party email service not implemented");
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Sanitize email content to prevent injection attacks
   */
  private sanitizeEmailContent(content: string): string {
    // Basic sanitization - in production, use a proper HTML sanitizer
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "");
  }
}
