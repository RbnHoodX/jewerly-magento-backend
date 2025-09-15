import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("UpdateCustomerEmail");

async function updateCustomerEmail() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error("Missing Supabase credentials (need service role key)");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Get the first order
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number, customer_id")
      .limit(1);

    if (ordersError) {
      logger.error("Error fetching orders:", ordersError);
      return;
    }

    if (!orders || orders.length === 0) {
      logger.error("No orders found");
      return;
    }

    const order = orders[0];
    logger.info(
      `Updating customer email for order ${order.shopify_order_number} (${order.id})`
    );

    // Update the customer's email
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .update({ email: "creativesoftware.dev1009@gmail.com" })
      .eq("id", order.customer_id)
      .select()
      .single();

    if (customerError) {
      logger.error("Error updating customer email:", customerError);
      return;
    }

    logger.info("Customer email updated successfully:", {
      customerId: customer.id,
      newEmail: customer.email,
      orderId: order.id,
      shopifyOrderNumber: order.shopify_order_number,
    });

    // Verify the update
    const { data: verifyCustomer, error: verifyError } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("id", order.customer_id)
      .single();

    if (verifyError) {
      logger.error("Error verifying customer update:", verifyError);
      return;
    }

    logger.info("Verification - Customer details:", verifyCustomer);
  } catch (error) {
    logger.error("Update customer email failed:", error);
  }
}

updateCustomerEmail();
