import { SupabaseClient } from "@supabase/supabase-js";
import {
  CustomerUpsertData,
  OrderInsertData,
  OrderItemInsertData,
  AddressInsertData,
  Address,
} from "../types";

export class DatabaseService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Generate the next customer ID in the format 000001, 000020, etc.
   * Uses a more robust approach to handle concurrent requests.
   */
  private async generateNextCustomerId(): Promise<string> {
    try {
      // Use a combination of timestamp and random number to ensure uniqueness
      const timestamp = Date.now().toString().slice(-4); // Last 4 digits of timestamp
      const random = Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, "0"); // 2-digit random
      const customerId = `${timestamp}${random}`;

      // Ensure it's 6 digits
      return customerId.padStart(6, "0");
    } catch (error) {
      console.error("Error generating customer ID:", error);
      // Fallback to timestamp-based ID if there's an error
      return Date.now().toString().slice(-6).padStart(6, "0");
    }
  }

  async checkOrderExists(shopifyOrderId: string): Promise<boolean> {
    // Check if order already exists by looking for the shopify_order_number in the orders table
    const { data, error } = await this.supabase
      .from("orders")
      .select("id")
      .eq("shopify_order_number", shopifyOrderId)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async checkOrderExistsByDetails(
    customerEmail: string,
    orderDate: string,
    totalAmount: number
  ): Promise<boolean> {
    // Alternative check: look for orders with same customer, date, and total amount
    const { data, error } = await this.supabase
      .from("orders")
      .select(
        `
        id,
        customers!inner(email),
        order_date,
        total_amount
      `
      )
      .eq("customers.email", customerEmail)
      .eq("order_date", orderDate)
      .eq("total_amount", totalAmount)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async markOrderAsImported(
    orderId: string,
    shopifyOrderId: string,
    shopifyOrderName: string
  ): Promise<void> {
    // Create a customer note to mark this order as imported from Shopify
    const { error } = await this.supabase.from("order_customer_notes").insert({
      order_id: orderId,
      content: `Shopify Order: ${shopifyOrderId} (${shopifyOrderName})`,
      status: "imported",
    });

    if (error) throw error;
  }

  async updateOrderTrackingNote(
    orderId: string,
    shopifyOrderId: string,
    shopifyOrderName: string
  ): Promise<void> {
    // Update existing tracking note instead of creating a new one
    // First find the existing note with the old format
    const { data: existingNote, error: findError } = await this.supabase
      .from("order_customer_notes")
      .select("id")
      .eq("order_id", orderId)
      .like("content", `Shopify Order: ${shopifyOrderId}%`)
      .limit(1)
      .maybeSingle();

    if (findError) throw findError;

    if (existingNote) {
      // Update existing note
      const { error: updateError } = await this.supabase
        .from("order_customer_notes")
        .update({
          content: `Shopify Order: ${shopifyOrderId} (${shopifyOrderName})`,
          status: "imported",
        })
        .eq("id", existingNote.id);

      if (updateError) throw updateError;
    } else {
      // Create new note if none exists
      await this.markOrderAsImported(orderId, shopifyOrderId, shopifyOrderName);
    }
  }

  async upsertCustomer(
    customerData: CustomerUpsertData
  ): Promise<string | undefined> {
    const { email, ...payload } = customerData;

    if (!email) return undefined;

    // Check if customer exists
    const { data: existing } = await this.supabase
      .from("customers")
      .select("id, customer_id")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      // Update existing customer with new address info
      const { error: updateErr } = await this.supabase
        .from("customers")
        .update(payload)
        .eq("id", existing.id);
      if (updateErr) {
        console.error("Customer update error:", updateErr);
        throw new Error(
          `Failed to update customer: ${
            updateErr.message || JSON.stringify(updateErr)
          }`
        );
      }
      return existing.id;
    } else {
      // Generate customer ID for new customer
      const customerId = await this.generateNextCustomerId();
      console.log(
        `🆔 Generated customer ID: ${customerId} for email: ${email}`
      );

      // Insert new customer with generated customer_id
      const { data: ins, error: insErr } = await this.supabase
        .from("customers")
        .insert({
          email,
          customer_id: customerId,
          ...payload,
        })
        .select("id")
        .single();
      if (insErr) {
        console.error("Customer insert error:", insErr);
        throw new Error(
          `Failed to insert customer: ${
            insErr.message || JSON.stringify(insErr)
          }`
        );
      }
      return ins.id;
    }
  }

  async createOrder(orderData: OrderInsertData): Promise<string> {
    const { data: newOrder, error: orderErr } = await this.supabase
      .from("orders")
      .insert(orderData)
      .select("id")
      .single();
    if (orderErr) {
      console.error("Order creation error:", orderErr);
      throw new Error(
        `Failed to create order: ${
          orderErr.message || JSON.stringify(orderErr)
        }`
      );
    }
    return newOrder.id;
  }

  async createOrderItems(items: OrderItemInsertData[]): Promise<void> {
    if (items.length === 0) return;

    const { error: itemErr } = await this.supabase
      .from("order_items")
      .insert(items);
    if (itemErr) {
      console.error("Order items creation error:", itemErr);
      throw new Error(
        `Failed to create order items: ${
          itemErr.message || JSON.stringify(itemErr)
        }`
      );
    }
  }

  async upsertBillingAddress(addressData: AddressInsertData): Promise<void> {
    const { error } = await this.supabase
      .from("order_billing_address")
      .insert(addressData);
    if (error) {
      console.error("Billing address insert error:", error);
      throw new Error(
        `Failed to insert billing address: ${
          error.message || JSON.stringify(error)
        }`
      );
    }
  }

  async upsertShippingAddress(addressData: AddressInsertData): Promise<void> {
    const { error } = await this.supabase
      .from("order_shipping_address")
      .insert(addressData);
    if (error) {
      console.error("Shipping address insert error:", error);
      throw new Error(
        `Failed to insert shipping address: ${
          error.message || JSON.stringify(error)
        }`
      );
    }
  }

  async createCompleteOrder(
    customerData: CustomerUpsertData,
    orderData: OrderInsertData,
    items: OrderItemInsertData[],
    billingAddress?: AddressInsertData,
    shippingAddress?: AddressInsertData
  ): Promise<string> {
    // Upsert customer
    const customerId = await this.upsertCustomer(customerData);

    // Create order with customer reference
    const orderWithCustomer = { ...orderData, customer_id: customerId };
    const orderId = await this.createOrder(orderWithCustomer);

    // Create order items
    const orderItems = items.map((item) => ({ ...item, order_id: orderId }));
    await this.createOrderItems(orderItems);

    // Create addresses if provided
    if (billingAddress) {
      await this.upsertBillingAddress({ ...billingAddress, order_id: orderId });
    }

    if (shippingAddress) {
      await this.upsertShippingAddress({
        ...shippingAddress,
        order_id: orderId,
      });
    }

    return orderId;
  }

  async deleteOrderData(orderId: string): Promise<void> {
    console.log(`🗑️ Deleting all data for order ${orderId}`);

    // Delete order items
    const { error: deleteItemsError } = await this.supabase
      .from("order_items")
      .delete()
      .eq("order_id", orderId);

    if (deleteItemsError) throw deleteItemsError;
    console.log(`   🛍️ Deleted order items`);

    // Delete billing address
    const { error: deleteBillingError } = await this.supabase
      .from("order_billing_address")
      .delete()
      .eq("order_id", orderId);

    if (deleteBillingError) throw deleteBillingError;
    console.log(`   🏠 Deleted billing address`);

    // Delete shipping address
    const { error: deleteShippingError } = await this.supabase
      .from("order_shipping_address")
      .delete()
      .eq("order_id", orderId);

    if (deleteShippingError) throw deleteShippingError;
    console.log(`   📦 Deleted shipping address`);

    // Delete order customer notes (except tracking notes)
    const { error: deleteNotesError } = await this.supabase
      .from("order_customer_notes")
      .delete()
      .eq("order_id", orderId)
      .not("content", "like", "Shopify Order:%");

    if (deleteNotesError) throw deleteNotesError;
    console.log(`   📝 Deleted customer notes (preserved tracking notes)`);

    console.log(`✅ All data deleted for order ${orderId}`);
  }

  async recreateOrderData(
    orderId: string,
    customerData: CustomerUpsertData,
    orderData: OrderInsertData,
    items: OrderItemInsertData[],
    billingAddress?: AddressInsertData,
    shippingAddress?: AddressInsertData
  ): Promise<void> {
    console.log(`🔄 Recreating order ${orderId} with fresh Shopify data`);

    // Update customer if email exists
    if (customerData.email) {
      console.log(`   📧 Updating customer: ${customerData.email}`);
      await this.upsertCustomer(customerData);
    }

    // Update order data - exclude fields that shouldn't be updated
    const { id, created_at, updated_at, customer_id, ...updateData } =
      orderData;

    // Only include fields that are safe to update
    const safeUpdateData = {
      purchase_from: updateData.purchase_from,
      order_date: updateData.order_date,
      total_amount: updateData.total_amount,
      bill_to_name: updateData.bill_to_name,
      ship_to_name: updateData.ship_to_name,
      delivery_method: updateData.delivery_method,
      shopify_order_number: updateData.shopify_order_number,
      customization_notes: updateData.customization_notes,
      previous_order_id: updateData.previous_order_id,
      how_did_you_hear: updateData.how_did_you_hear,
      labor: updateData.labor,
      cad_cost: updateData.cad_cost,
      general_cost: updateData.general_cost,
    };

    // Remove undefined values
    const cleanUpdateData = Object.fromEntries(
      Object.entries(safeUpdateData).filter(([_, value]) => value !== undefined)
    );

    console.log(`   📦 Updating order fields:`, Object.keys(cleanUpdateData));

    const { error: orderError } = await this.supabase
      .from("orders")
      .update(cleanUpdateData)
      .eq("id", orderId);

    if (orderError) {
      console.error("Order update error:", orderError);
      throw new Error(
        `Failed to update order: ${
          orderError.message || JSON.stringify(orderError)
        }`
      );
    }

    // Create new order items
    if (items && items.length > 0) {
      console.log(`   🛍️ Creating ${items.length} order items`);
      const orderItems = items.map((item) => ({ ...item, order_id: orderId }));
      await this.createOrderItems(orderItems);
    }

    // Create new addresses
    if (billingAddress) {
      console.log(`   🏠 Creating billing address`);
      await this.upsertBillingAddress({ ...billingAddress, order_id: orderId });
    }

    if (shippingAddress) {
      console.log(`   📦 Creating shipping address`);
      await this.upsertShippingAddress({
        ...shippingAddress,
        order_id: orderId,
      });
    }

    console.log(`✅ Order ${orderId} recreated successfully`);
  }

  async getOrderIdByShopifyId(shopifyOrderId: string): Promise<string | null> {
    // Find order ID by looking for the Shopify tracking note
    const { data, error } = await this.supabase
      .from("order_customer_notes")
      .select("order_id")
      .eq("content", `Shopify Order: ${shopifyOrderId}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.order_id || null;
  }

  async getOrderIdByShopifyOrderNumber(
    shopifyOrderNumber: string
  ): Promise<string | null> {
    // Find order ID by looking for the shopify_order_number field
    const { data, error } = await this.supabase
      .from("orders")
      .select("id")
      .eq("shopify_order_number", shopifyOrderNumber)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id || null;
  }

  async getExistingOrderData(orderId: string): Promise<any> {
    // Get existing order data to preserve fields not synced from Shopify
    const { data, error } = await this.supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) throw error;
    return data;
  }
}
