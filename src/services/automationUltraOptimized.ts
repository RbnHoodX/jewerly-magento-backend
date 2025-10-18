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
  note?: string | null;
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
  order_items?: any[];
  latest_note_created_at?: string;
}

export class UltraOptimizedAutomationService {
  private supabase: any;
  private logger: Logger;
  private emailService: ShopifyEmailService;
  private batchSize: number = 50; // Process 50 orders at once
  private maxConcurrency: number = 10; // Max 10 parallel operations

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.logger = new Logger("UltraOptimizedAutomationService");
    this.emailService = new ShopifyEmailService();
  }

  /**
   * Main automation workflow - ULTRA OPTIMIZED VERSION
   */
  async runAutomation(): Promise<void> {
    const startTime = performance.now();
    
    try {
      this.logger.log("info", "Starting ultra-optimized automation workflow");

      // Get all active status rules in one query
      const rules = await this.getActiveStatusRules();
      this.logger.log("info", `Found ${rules.length} active status rules`);

      if (rules.length === 0) {
        this.logger.log("info", "No active rules found, skipping automation");
        return;
      }

      // Process all rules in parallel with controlled concurrency
      await this.processRulesWithConcurrency(rules);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      this.logger.log("info", `Ultra-optimized automation workflow completed in ${duration}ms`);
    } catch (error) {
      this.logger.log("error", "Automation workflow failed", { error });
      throw error;
    }
  }

  /**
   * Process rules with controlled concurrency to avoid overwhelming the system
   */
  private async processRulesWithConcurrency(rules: StatusRule[]): Promise<void> {
    const chunks = this.chunkArray(rules, this.maxConcurrency);
    
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(rule => this.processStatusRuleOptimized(rule))
      );
      
      // Small delay between chunks to prevent overwhelming the database
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
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
   * ULTRA OPTIMIZED: Process a single status rule
   */
  private async processStatusRuleOptimized(rule: StatusRule): Promise<void> {
    try {
      // Use the most efficient query possible
      const orders = await this.getOrdersWithStatusUltraOptimized(rule.status);

      if (orders.length === 0) {
        return;
      }

      // Process orders in optimized batches
      await this.processOrdersInBatches(orders, rule);

    } catch (error) {
      this.logger.log("error", `Failed to process rule ${rule.id}`, { error });
    }
  }

  /**
   * ULTRA OPTIMIZED: Get orders with specific status using the most efficient query
   */
  private async getOrdersWithStatusUltraOptimized(status: string): Promise<OrderData[]> {
    // Use a direct query approach that's more reliable than RPC
    return await this.getOrdersWithStatusFallback(status);
  }

  /**
   * ULTRA OPTIMIZED: Get orders with specific status using efficient direct query
   */
  private async getOrdersWithStatusFallback(status: string): Promise<OrderData[]> {
    // First, try to get orders that have notes with the target status
    this.logger.log("info", `Looking for orders with status: ${status}`);
    
    // Get order IDs that have the target status
    const { data: orderIds, error: idsError } = await this.supabase
      .from("order_customer_notes")
      .select("order_id")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(1000); // Get more orders

    if (idsError) {
      this.logger.log("error", "Failed to fetch order IDs", { error: idsError });
      throw idsError;
    }

    if (!orderIds || orderIds.length === 0) {
      this.logger.log("info", `No orders found with status: ${status}`);
      return [];
    }

    this.logger.log("info", `Found ${orderIds.length} order IDs with status: ${status}`);

    // Get the full order data for these specific orders
    const { data: allOrders, error: ordersError } = await this.supabase
      .from("orders")
      .select(`
        id,
        shopify_order_number,
        customer_id,
        customers!inner(
          id,
          name,
          email
        ),
        order_items(
          id,
          sku,
          details,
          qty,
          price
        )
      `)
      .in("id", orderIds.map(item => item.order_id))
      .limit(1000); // Increased limit

    if (ordersError) {
      this.logger.log("error", "Failed to fetch orders", { error: ordersError });
      throw ordersError;
    }

    if (!allOrders || allOrders.length === 0) {
      this.logger.log("info", "No orders found for the given order IDs");
      return [];
    }

    this.logger.log("info", `Found ${allOrders.length} orders with customer data`);

    // Now we need to verify that these orders actually have the target status as their LATEST note
    const validOrders: OrderData[] = [];
    
    for (const order of allOrders) {
      // Get the latest note for this order
      const { data: latestNote, error: noteError } = await this.supabase
        .from("order_customer_notes")
        .select("status, created_at")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (noteError) {
        this.logger.log("warn", `Failed to fetch latest note for order ${order.id}`, { error: noteError });
        continue;
      }

      if (latestNote && latestNote.status === status) {
        validOrders.push(order);
        this.logger.log("info", `Order ${order.id} has latest status: ${status}`);
      } else {
        this.logger.log("info", `Order ${order.id} latest status: ${latestNote?.status || 'unknown'}, not ${status}`);
      }
    }

    this.logger.log("info", `Found ${validOrders.length} orders with latest status '${status}'`);

    return validOrders;
  }

  /**
   * Process orders in optimized batches with parallel execution
   */
  private async processOrdersInBatches(orders: OrderData[], rule: StatusRule): Promise<void> {
    const chunks = this.chunkArray(orders, this.batchSize);
    
    for (const chunk of chunks) {
      // Process each chunk in parallel
      await Promise.all(
        chunk.map(order => this.processOrderForRuleOptimized(order, rule))
      );
      
      // Small delay between batches
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * ULTRA OPTIMIZED: Process a single order for a rule
   */
  private async processOrderForRuleOptimized(order: OrderData, rule: StatusRule): Promise<void> {
    try {
      // Check if this order already has the new status (optimized check)
      const latestNote = await this.getLatestCustomerNoteOptimized(order.id);
      
      if (latestNote && latestNote.status === rule.new_status) {
        return; // Skip if already processed
      }

      // Check wait time if not instant
      if (rule.wait_time_business_days > 0) {
        const shouldTransition = await this.shouldTransitionStatusOptimized(order.id, rule, latestNote);
        if (!shouldTransition) {
          return;
        }
      }

      // Process the status transition
      await this.processStatusTransitionOptimized(order, rule, latestNote);
    } catch (error) {
      this.logger.log("error", `Failed to process order ${order.id}`, { error });
    }
  }

  /**
   * OPTIMIZED: Get the latest customer note for an order
   */
  private async getLatestCustomerNoteOptimized(orderId: string): Promise<OrderCustomerNote | null> {
    const { data, error } = await this.supabase
      .from("order_customer_notes")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.log("error", `Failed to fetch latest note for order ${orderId}`, { error });
      return null;
    }

    return data;
  }

  /**
   * OPTIMIZED: Check if enough business days have passed for status transition
   */
  private async shouldTransitionStatusOptimized(
    orderId: string, 
    rule: StatusRule, 
    latestNote: OrderCustomerNote | null
  ): Promise<boolean> {
    if (!latestNote) {
      return false;
    }

    const startDate = new Date(latestNote.created_at!);
    const endDate = new Date();
    const businessDays = this.calculateBusinessDays(startDate, endDate);

    // Enhanced logging for debugging timing issues
    this.logger.log("info", `Timing check for order ${orderId}:`, {
      rule: `${rule.status} -> ${rule.new_status}`,
      waitTimeRequired: rule.wait_time_business_days,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      businessDaysPassed: businessDays,
      shouldTransition: businessDays >= rule.wait_time_business_days,
      latestNoteId: latestNote.id,
      latestNoteStatus: latestNote.status
    });

    return businessDays >= rule.wait_time_business_days;
  }

  /**
   * Calculate business days between two dates (optimized)
   * FIXED: Now correctly calculates business days AFTER the start date
   */
  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    const end = new Date(endDate);

    // Start counting from the NEXT day after the start date
    current.setDate(current.getDate() + 1);

    while (current < end) { // Changed from <= to < to exclude the end date
      const dayOfWeek = current.getDay();
      // Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
      // Saturday=6, Sunday=0
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * ULTRA OPTIMIZED: Process the actual status transition
   */
  private async processStatusTransitionOptimized(
    order: OrderData,
    rule: StatusRule,
    latestNote: OrderCustomerNote | null
  ): Promise<void> {
    try {
      this.logger.log(
        "info",
        `Processing status transition for order ${order.id}: ${rule.status} -> ${rule.new_status}`
      );

      // Insert new status note
      const newNote = await this.insertStatusNoteOptimized(
        order.id,
        rule.new_status,
        rule
      );

      // Send emails in parallel
      await this.sendStatusEmailsOptimized(order, rule, newNote);

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
   * OPTIMIZED: Insert a new status note
   */
  private async insertStatusNoteOptimized(
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
   * ULTRA OPTIMIZED: Send status emails in parallel
   */
  private async sendStatusEmailsOptimized(
    order: OrderData,
    rule: StatusRule,
    note: OrderCustomerNote
  ): Promise<void> {
    const emailPromises = [];

    // Send private email if configured (INSTEAD OF customer email)
    if (rule.private_email) {
      emailPromises.push(this.sendPrivateEmailOptimized(order, rule, note));
    } else if (rule.email_subject && rule.email_custom_message) {
      // Send customer email only if no private email is configured
      emailPromises.push(this.sendCustomerEmailOptimized(order, rule, note));
    }

    // Send additional recipient emails if configured
    if (rule.additional_recipients && rule.additional_recipients.length > 0) {
      emailPromises.push(this.sendAdditionalEmailsOptimized(order, rule, note));
    }

    // Execute all email sends in parallel
    await Promise.all(emailPromises);
  }

  /**
   * OPTIMIZED: Send customer email
   */
  private async sendCustomerEmailOptimized(
    order: OrderData,
    rule: StatusRule,
    note: OrderCustomerNote
  ): Promise<void> {
    const subject = this.replacePlaceholders(rule.email_subject!, order, note);
    const message = this.replacePlaceholders(rule.email_custom_message!, order, note);

    try {
      await this.emailService.sendEmail({
        to: order.customers.email!,
        subject,
        body: message,
        orderId: order.id,
        type: "customer",
      });
    } catch (error) {
      // Gmail SMTP may block external domains - log but don't fail automation
      this.logger.log("warn", "Failed to send customer email (Gmail SMTP restriction)", {
        orderId: order.id,
        customerEmail: order.customers.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * OPTIMIZED: Send private email
   */
  private async sendPrivateEmailOptimized(
    order: OrderData,
    rule: StatusRule,
    note: OrderCustomerNote
  ): Promise<void> {
    const subject = `[AUTOMATION] ${rule.status} -> ${rule.new_status} - Order ${order.shopify_order_number}`;
    const message = `
      Order: ${order.shopify_order_number}
      Customer: ${order.customers.name} (${order.customers.email})
      Status Change: ${rule.status} -> ${rule.new_status}
      Time: ${formatDateTimeToEST(new Date())}
    `;

    await this.emailService.sendEmail({
      to: rule.private_email!,
      subject,
      body: message,
      orderId: order.id,
      type: "private",
    });
  }

  /**
   * OPTIMIZED: Send additional recipient emails
   */
  private async sendAdditionalEmailsOptimized(
    order: OrderData,
    rule: StatusRule,
    note: OrderCustomerNote
  ): Promise<void> {
    const emailPromises = rule.additional_recipients!.map(recipient => {
      const subject = `[AUTOMATION] ${rule.status} -> ${rule.new_status} - Order ${order.shopify_order_number}`;
      const message = `
        Order: ${order.shopify_order_number}
        Customer: ${order.customers.name} (${order.customers.email})
        Status Change: ${rule.status} -> ${rule.new_status}
        Time: ${formatDateTimeToEST(new Date())}
      `;

      return this.emailService.sendEmail({
        to: recipient,
        subject,
        body: message,
        orderId: order.id,
        type: "internal",
      });
    });
    
    await Promise.all(emailPromises);
  }

  /**
   * Replace placeholders in email content
   */
  private replacePlaceholders(
    content: string,
    order: OrderData,
    note: OrderCustomerNote
  ): string {
    // Generate order summary from order items
    const orderSummary = this.generateOrderSummary(order);

    return content
      .replace(/\{\{ order_number \}\}/g, order.shopify_order_number || "")
      .replace(/\{\{ order_name \}\}/g, order.shopify_order_number || order.id || "")
      .replace(/\{\{ customer_name \}\}/g, order.customers.name || "")
      .replace(/\{\{ customer_email \}\}/g, order.customers.email || "")
      .replace(/\{\{ order_summary \}\}/g, orderSummary)
      .replace(/\{\{ status \}\}/g, note.status || "")
      .replace(/\{\{ note \}\}/g, note.content || "")
      .replace(/\{\{ date \}\}/g, formatDateToEST(new Date()))
      .replace(/\{\{ time \}\}/g, formatTimeToEST(new Date()));
  }

  /**
   * Generate order summary from order items
   */
  private generateOrderSummary(order: OrderData): string {
    if (!order.order_items || order.order_items.length === 0) {
      return "No items found";
    }

    return order.order_items
      .map((item) => {
        const details = item.details ? ` (${item.details})` : "";
        return `${item.sku}${details} - Qty: ${item.qty} - $${item.price}`;
      })
      .join("\n");
  }

  /**
   * Utility function to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
