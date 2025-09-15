import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("AddCastingOrderNote");

async function addCastingOrderNote() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    logger.error("Missing Supabase credentials (need service role key)");
    logger.info("Please set SUPABASE_SERVICE_ROLE_KEY in your .env file");
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
      `Adding "Casting Order" note to order ${order.shopify_order_number} (${order.id})`
    );

    // Add a customer note with "Casting Order" status using the correct column name
    const { data: note, error: noteError } = await supabase
      .from("order_customer_notes")
      .insert({
        order_id: order.id,
        status: "Casting Order",
        content:
          "Test customer note - Casting Order status for automation testing",
        created_by: null,
      })
      .select()
      .single();

    if (noteError) {
      logger.error("Error adding Casting Order note:", noteError);
      return;
    }

    logger.info("Casting Order note added successfully:", note);

    // Verify the note was added
    const { data: verifyNotes, error: verifyError } = await supabase
      .from("order_customer_notes")
      .select("*")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false });

    if (verifyError) {
      logger.error("Error verifying notes:", verifyError);
      return;
    }

    logger.info(
      `Verified: Found ${verifyNotes?.length || 0} notes for order ${order.id}`
    );
    if (verifyNotes && verifyNotes.length > 0) {
      logger.info("All notes for this order:");
      verifyNotes.forEach((note, index) => {
        logger.info(
          `  ${index + 1}. Status: "${note.status}", Content: "${note.content}"`
        );
      });
    }
  } catch (error) {
    logger.error("Add Casting Order note failed:", error);
  }
}

addCastingOrderNote();
