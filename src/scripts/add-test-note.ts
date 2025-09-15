import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("AddTestNote");

async function addTestNote() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get the first order to add a note to
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .limit(1);

    if (ordersError) {
      logger.error("Error fetching orders:", ordersError);
      return;
    }

    if (!orders || orders.length === 0) {
      logger.error("No orders found to add note to");
      return;
    }

    const order = orders[0];
    logger.info(
      `Adding test note to order ${order.shopify_order_number} (${order.id})`
    );

    // Add a test customer note with "Casting Order" status
    const { data: note, error: noteError } = await supabase
      .from("order_customer_notes")
      .insert({
        order_id: order.id,
        status: "Casting Order",
        note: "Test customer note - Casting Order status",
        is_automated: false,
        triggered_by_rule_id: null,
        created_by: null,
      })
      .select()
      .single();

    if (noteError) {
      logger.error("Error adding test note:", noteError);
      return;
    }

    logger.info("Test note added successfully:", note);

    // Verify the note was added
    const { data: verifyNotes, error: verifyError } = await supabase
      .from("order_customer_notes")
      .select("*")
      .eq("order_id", order.id);

    if (verifyError) {
      logger.error("Error verifying note:", verifyError);
      return;
    }

    logger.info(
      `Verified: Found ${verifyNotes?.length || 0} notes for order ${order.id}`
    );
    if (verifyNotes && verifyNotes.length > 0) {
      logger.info("Notes:", verifyNotes);
    }
  } catch (error) {
    logger.error("Add test note failed:", error);
  }
}

addTestNote();
