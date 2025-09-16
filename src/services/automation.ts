import { Database } from "../integrations/supabase/types";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";
import { ShopifyEmailService } from "./shopifyEmail";
import {
  formatDateTimeToEST,
  formatDateToEST,
  formatTimeToEST,
} from "../utils/timezone";

export interface StatusRule {
  id: string;
  status: string;
  new_status: string;
  wait_time_business_days: number;
  description: string | null;
  private_email: string | null;
  email_subject: string | null;
  email_custom_message: string | null;
  additional_recipients: string[] | null;
  is_active: boolean | null;
}

export interface OrderCustomerNote {
  id: string;
  order_id: string;
  status: string;
  content: string | null;
  is_automated?: boolean | null;
  triggered_by_rule_id?: string | null;
  created_at: string | null;
  created_by: string | null;
}

export interface OrderData {
  id: string;
  shopify_order_number: string | null;
  customer_id: string;
  customers: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

export class AutomationService {
  private supabase: any;
  private logger: Logger;
  private emailService: ShopifyEmailService;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.logger = new Logger("AutomationService");
    this.emailService = new ShopifyEmailService();
  }

  /**
   * Main automation workflow - runs hourly
   */
  async runAutomation(): Promise<void> {
    try {
      this.logger.log("info", "Starting automation workflow");

      // Get all active status rules
      const rules = await this.getActiveStatusRules();
      this.logger.log("info", `Found ${rules.length} active status rules`);

      // Process each rule
      for (const rule of rules) {
        await this.processStatusRule(rule);
      }

      this.logger.log("info", "Automation workflow completed");
    } catch (error) {
      this.logger.log("error", "Automation workflow failed", { error });
      throw error;
    }
  }

  /**
   * Get all active status rules from the database
   */
  private async getActiveStatusRules(): Promise<StatusRule[]> {
    const { data, error } = await this.supabase
      .from("statuses_model")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) {
      this.logger.log("error", "Failed to fetch status rules", { error });
      throw error;
    }

    return data || [];
  }

  /**
   * Process a single status rule
   */
  private async processStatusRule(rule: StatusRule): Promise<void> {
    try {
      this.logger.log(
        "info",
        `Processing rule: ${rule.status} -> ${rule.new_status}`
      );

      // Find orders with the current status
      const orders = await this.getOrdersWithStatus(rule.status);
      this.logger.log(
        "info",
        `Found ${orders.length} orders with status: ${rule.status}`
      );

      for (const order of orders) {
        await this.processOrderForRule(order, rule);
      }
    } catch (error) {
      this.logger.log("error", `Failed to process rule ${rule.id}`, { error });
    }
  }

  /**
   * Get orders that have the specified status as their latest customer note
   */
  private async getOrdersWithStatus(status: string): Promise<OrderData[]> {
    // Get all orders first
    const { data: allOrders, error: ordersError } = await this.supabase
      .from("orders")
      .select("id, shopify_order_number, customer_id");

    if (ordersError) {
      this.logger.log("error", "Failed to fetch orders", {
        error: ordersError,
      });
      throw ordersError;
    }

    if (!allOrders || allOrders.length === 0) {
      return [];
    }

    // For each order, check if the latest customer note has the target status
    const validOrders: OrderData[] = [];

    for (const order of allOrders) {
      const latestNote = await this.getLatestCustomerNote(order.id);

      if (latestNote && latestNote.status === status) {
        // Get customer data for this order
        const { data: customer, error: customerError } = await this.supabase
          .from("customers")
          .select("id, name, email")
          .eq("id", order.customer_id)
          .single();

        if (customerError) {
          this.logger.log(
            "warn",
            `Failed to fetch customer for order ${order.id}`,
            {
              error: customerError,
            }
          );
          continue;
        }

        validOrders.push({
          id: order.id,
          shopify_order_number: order.shopify_order_number,
          customer_id: order.customer_id,
          customers: customer,
        } as OrderData);
      }
    }

    return validOrders;
  }

  /**
   * Process a single order for a status rule
   */
  private async processOrderForRule(
    order: OrderData,
    rule: StatusRule
  ): Promise<void> {
    try {
      // Get the latest customer note for this order
      const latestNote = await this.getLatestCustomerNote(order.id);

      if (!latestNote) {
        this.logger.log(
          "warn",
          `No customer notes found for order ${order.id}`
        );
        return;
      }

      // Check if this order should be processed based on wait time
      const shouldProcess = await this.shouldProcessOrder(latestNote, rule);

      if (!shouldProcess) {
        this.logger.log(
          "debug",
          `Order ${order.id} not ready for processing yet`
        );
        return;
      }

      // Process the status transition
      await this.processStatusTransition(order, rule, latestNote);
    } catch (error) {
      this.logger.log(
        "error",
        `Failed to process order ${order.id} for rule ${rule.id}`,
        { error }
      );
    }
  }

  /**
   * Get the latest customer note for an order
   */
  private async getLatestCustomerNote(
    orderId: string
  ): Promise<OrderCustomerNote | null> {
    const { data, error } = await this.supabase
      .from("order_customer_notes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // No notes found
      }
      throw error;
    }

    return data;
  }

  /**
   * Check if an order should be processed based on wait time
   */
  private async shouldProcessOrder(
    note: OrderCustomerNote,
    rule: StatusRule
  ): Promise<boolean> {
    if (rule.wait_time_business_days === 0) {
      return true;
    }

    const noteDate = new Date(note.created_at!);
    const businessDaysElapsed = this.calculateBusinessDays(
      noteDate,
      new Date()
    );

    return businessDaysElapsed >= rule.wait_time_business_days;
  }

  /**
   * Calculate business days between two dates
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Process the actual status transition
   */
  private async processStatusTransition(
    order: OrderData,
    rule: StatusRule,
    latestNote: OrderCustomerNote
  ): Promise<void> {
    try {
      this.logger.log(
        "info",
        `Processing status transition for order ${order.id}: ${rule.status} -> ${rule.new_status}`
      );

      // Insert new status note
      const newNote = await this.insertStatusNote(
        order.id,
        rule.new_status,
        rule
      );

      // Send emails
      await this.sendStatusEmails(order, rule, newNote);

      this.logger.log(
        "info",
        `Successfully processed status transition for order ${order.id}`
      );
    } catch (error) {
      this.logger.log(
        "error",
        `Failed to process status transition for order ${order.id}`,
        { error }
      );
      throw error;
    }
  }

  /**
   * Insert a new status note
   */
  private async insertStatusNote(
    orderId: string,
    status: string,
    rule: StatusRule
  ): Promise<OrderCustomerNote> {
    const { data, error } = await this.supabase
      .from("order_customer_notes")
      .insert({
        order_id: orderId,
        status: status,
        content: rule.description,
        // Note: is_automated and triggered_by_rule_id columns don't exist yet
        // We'll add them in a migration later
      })
      .select()
      .single();

    if (error) {
      this.logger.log("error", "Failed to insert status note", { error });
      throw error;
    }

    return data;
  }

  /**
   * Send all required emails for a status transition
   */
  private async sendStatusEmails(
    order: OrderData,
    rule: StatusRule,
    newNote: OrderCustomerNote
  ): Promise<void> {
    const emails = [];

    // Only send customer emails if we have email content
    if (
      order.customers.email &&
      rule.email_subject &&
      rule.email_custom_message
    ) {
      emails.push({
        type: "customer" as const,
        recipient: order.customers.email,
        subject: this.replacePlaceholders(rule.email_subject, order, newNote),
        message: this.replacePlaceholders(
          rule.email_custom_message,
          order,
          newNote
        ),
      });
    }

    // Private email notification (always send if private_email is configured)
    if (rule.private_email) {
      const privateEmailContent = this.generatePrivateEmailContent(
        order,
        rule,
        newNote
      );
      emails.push({
        type: "private" as const,
        recipient: rule.private_email,
        subject: privateEmailContent.subject,
        message: privateEmailContent.message,
      });
    }

    // Private email copy (only if we have email content and it's different from private notification)
    if (rule.private_email && rule.email_subject && rule.email_custom_message) {
      emails.push({
        type: "private_copy" as const,
        recipient: rule.private_email,
        subject: `[COPY] ${this.replacePlaceholders(
          rule.email_subject,
          order,
          newNote
        )}`,
        message: this.replacePlaceholders(
          rule.email_custom_message,
          order,
          newNote
        ),
      });
    }

    // Additional recipients (only if we have email content)
    if (
      rule.additional_recipients &&
      rule.additional_recipients.length > 0 &&
      rule.email_subject &&
      rule.email_custom_message
    ) {
      for (const recipient of rule.additional_recipients) {
        emails.push({
          type: "additional" as const,
          recipient: recipient,
          subject: this.replacePlaceholders(rule.email_subject, order, newNote),
          message: this.replacePlaceholders(
            rule.email_custom_message,
            order,
            newNote
          ),
        });
      }
    }

    // Send all emails
    for (const email of emails) {
      await this.sendEmail(
        order.id,
        rule.id,
        email,
        newNote,
        order.customer_id
      );
    }
  }

  /**
   * Send a single email and log it
   */
  private async sendEmail(
    orderId: string,
    ruleId: string,
    email: {
      type: "customer" | "private" | "private_copy" | "additional";
      recipient: string;
      subject: string;
      message: string;
    },
    note: OrderCustomerNote,
    customerId?: string
  ): Promise<void> {
    try {
      // Log email attempt
      const { data: logEntry, error: logError } = await this.supabase
        .from("email_logs")
        .insert({
          order_id: orderId,
          status_rule_id: ruleId,
          email_type: email.type,
          recipient_email: email.recipient,
          subject: email.subject,
          message: email.message,
          status: "pending",
        })
        .select()
        .single();

      if (logError) {
        this.logger.log("error", "Failed to log email attempt", {
          error: logError,
        });
        return;
      }

      // Send email via Shopify API
      const shopifyEmailId = await this.emailService.sendEmail({
        to: email.recipient,
        subject: email.subject,
        body: email.message,
        orderId: orderId,
        customerId: email.type === "customer" ? customerId : undefined,
      });

      // Update log with success
      await this.supabase
        .from("email_logs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          shopify_email_id: shopifyEmailId,
        })
        .eq("id", logEntry.id);

      this.logger.log("info", `Email sent successfully to ${email.recipient}`, {
        orderId,
        emailType: email.type,
        shopifyEmailId,
      });
    } catch (error) {
      // Update log with failure
      await this.supabase
        .from("email_logs")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : String(error),
        })
        .eq("order_id", orderId)
        .eq("recipient_email", email.recipient)
        .eq("status", "pending");

      this.logger.log("error", `Failed to send email to ${email.recipient}`, {
        error,
      });
    }
  }

  /**
   * Generate private email content for status updates
   */
  private generatePrivateEmailContent(
    order: OrderData,
    rule: StatusRule,
    newNote: OrderCustomerNote
  ): { subject: string; message: string } {
    const orderNumber =
      order.shopify_order_number || order.id.slice(-8).toUpperCase();
    const customerName = order.customers.name || "Unknown Customer";
    const customerEmail = order.customers.email || "No email";
    const status = newNote.status;
    const waitTime = rule.wait_time_business_days;
    const currentTime = formatDateTimeToEST(new Date());

    const subject = `Order Update: #${orderNumber} - ${rule.status} → ${status}`;

    const message = `Order Update Notification

Order #${orderNumber} has been updated:
- From: ${rule.status}
- To: ${status}
- Customer: ${customerName} (${customerEmail})
- Wait Time: ${waitTime} business days
- Updated: ${currentTime}

${rule.description ? `Description: ${rule.description}` : ""}

This is an automated notification from the order management system.`;

    return { subject, message };
  }

  /**
   * Replace placeholders in email content
   */
  private replacePlaceholders(
    content: string | null,
    order: OrderData,
    note: OrderCustomerNote
  ): string {
    if (!content) {
      return "";
    }
    const placeholders: Record<string, string> = {
      "{{ order_number }}": order.shopify_order_number || order.id,
      "{{ customer_name }}": order.customers.name || "Valued Customer",
      "{{ customer_email }}": order.customers.email || "",
      "{{ status }}": note.status,
      "{{ note }}": note.note || "",
      "{{ date }}": formatDateToEST(new Date()),
      "{{ time }}": formatTimeToEST(new Date()),
    };

    let result = content;
    for (const [placeholder, value] of Object.entries(placeholders)) {
      result = result.replace(
        new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "g"),
        value
      );
    }

    return result;
  }
}
