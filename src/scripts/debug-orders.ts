import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("DebugOrders");

async function debugOrders() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Check if we have any orders
    logger.info("Checking orders...");
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .limit(5);

    if (ordersError) {
      logger.error("Error fetching orders:", ordersError);
      return;
    }

    logger.info(`Found ${orders?.length || 0} orders`);
    if (orders && orders.length > 0) {
      logger.info("Sample orders:", orders);
    }

    // Check if we have any customer notes
    logger.info("Checking customer notes...");
    const { data: notes, error: notesError } = await supabase
      .from("order_customer_notes")
      .select("id, order_id, status, created_at")
      .limit(10);

    if (notesError) {
      logger.error("Error fetching notes:", notesError);
      return;
    }

    logger.info(`Found ${notes?.length || 0} customer notes`);
    if (notes && notes.length > 0) {
      logger.info("Sample notes:", notes);
    }

    // Check for specific "Casting Order" status
    logger.info("Checking for 'Casting Order' status...");
    const { data: castingNotes, error: castingError } = await supabase
      .from("order_customer_notes")
      .select("id, order_id, status, created_at")
      .eq("status", "Casting Order");

    if (castingError) {
      logger.error("Error fetching casting notes:", castingError);
      return;
    }

    logger.info(
      `Found ${castingNotes?.length || 0} notes with 'Casting Order' status`
    );
    if (castingNotes && castingNotes.length > 0) {
      logger.info("Casting Order notes:", castingNotes);
    }

    // Test the join query
    logger.info("Testing join query...");
    const { data: joinedData, error: joinError } = await supabase
      .from("orders")
      .select(
        `
        id,
        shopify_order_number,
        order_customer_notes!inner (
          id,
          status,
          created_at
        )
      `
      )
      .limit(5);

    if (joinError) {
      logger.error("Error with join query:", joinError);
      return;
    }

    logger.info(`Found ${joinedData?.length || 0} orders with notes`);
    if (joinedData && joinedData.length > 0) {
      logger.info(
        "Joined data sample:",
        JSON.stringify(joinedData[0], null, 2)
      );
    }
  } catch (error) {
    logger.error("Debug failed:", error);
  }
}

debugOrders();
