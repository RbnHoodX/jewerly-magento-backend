import { Logger } from "../utils/logger";
import sgMail from "@sendgrid/mail";

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
}

export class ShopifyEmailService {
  private logger: Logger;
  private shopifyAccessToken: string;
  private shopifyShopDomain: string;
  private sendGridApiKey: string;
  private fromEmail: string;
  private isConfigured: boolean;
  private useSendGrid: boolean;

  constructor() {
    this.logger = new Logger("ShopifyEmailService");

    // Get credentials from environment variables
    this.shopifyAccessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
    this.shopifyShopDomain = process.env.SHOPIFY_SHOP_DOMAIN || "";
    this.sendGridApiKey = process.env.SENDGRID_API_KEY || "";
    this.fromEmail = process.env.FROM_EMAIL || "noreply@primestyle.com";

    this.isConfigured = !!(this.shopifyAccessToken && this.shopifyShopDomain);
    this.useSendGrid = !!this.sendGridApiKey;

    if (this.useSendGrid) {
      sgMail.setApiKey(this.sendGridApiKey);
      this.logger.log("info", "SendGrid configured for email sending");
    } else if (!this.isConfigured) {
      this.logger.log(
        "warn",
        "No email service configured. Using mock email sending."
      );
    }
  }

  /**
   * Send an email via SendGrid or Shopify API
   */
  async sendEmail(emailData: EmailData): Promise<string> {
    try {
      if (this.useSendGrid) {
        return await this.sendEmailViaSendGrid(emailData);
      } else if (this.isConfigured) {
        return await this.sendEmailViaShopifyNotification(emailData);
      } else {
        // Return a mock email ID for testing purposes when no service is configured
        const mockEmailId = `mock_email_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        this.logger.log(
          "info",
          "Mock email sent (no email service configured)",
          {
            emailId: mockEmailId,
            to: emailData.to,
            subject: emailData.subject,
          }
        );

        return mockEmailId;
      }
    } catch (error) {
      this.logger.log("error", "Failed to send email", { error });
      throw error;
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
   * Send email via Shopify notification system
   * This is a placeholder implementation - in reality, you'd need to:
   * 1. Use Shopify's Admin API to create a notification
   * 2. Or integrate with a third-party email service (SendGrid, Mailgun, etc.)
   * 3. Or use Shopify's webhook system to trigger email sending
   */
  private async sendEmailViaShopifyNotification(
    emailData: EmailData
  ): Promise<string> {
    // This is a mock implementation
    // In a real scenario, you would:
    // 1. Make an API call to Shopify's notification system
    // 2. Or use a third-party email service
    // 3. Or trigger a webhook that handles email sending

    const emailId = `shopify_email_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    this.logger.log("info", "Mock email sent", {
      emailId,
      to: emailData.to,
      subject: emailData.subject,
      bodyLength: emailData.body.length,
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100));

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
