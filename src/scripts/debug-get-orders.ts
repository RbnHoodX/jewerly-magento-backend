import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("DebugGetOrders");

async function debugGetOrders() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const targetStatus = "Casting Order";
    logger.info(`Debugging getOrdersWithStatus for status: "${targetStatus}"`);

    // Step 1: Get all orders first
    logger.info("Step 1: Getting all orders...");
    const { data: allOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number, customer_id");

    if (ordersError) {
      logger.error("Error fetching orders:", ordersError);
      return;
    }

    logger.info(`Found ${allOrders?.length || 0} orders`);

    if (allOrders && allOrders.length > 0) {
      logger.info("Sample order:", JSON.stringify(allOrders[0], null, 2));
    }

    // Step 2: For each order, get the latest customer note
    logger.info("Step 2: Checking latest notes for each order...");
    const validOrders = [];

    for (const order of allOrders || []) {
      logger.info(`Checking order ${order.shopify_order_number} (${order.id})`);

      // Get the latest customer note for this order
      const { data: latestNote, error: noteError } = await supabase
        .from("order_customer_notes")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (noteError) {
        if (noteError.code === "PGRST116") {
          logger.info(`  No notes found for order ${order.id}`);
        } else {
          logger.error(
            `  Error fetching latest note for order ${order.id}:`,
            noteError
          );
        }
        continue;
      }

      logger.info(`  Latest note status: "${latestNote.status}"`);

      if (latestNote.status === targetStatus) {
        logger.info(
          `  ✅ Order ${order.shopify_order_number} has latest status "${targetStatus}"`
        );
        validOrders.push(order);
      } else {
        logger.info(
          `  ❌ Order ${order.shopify_order_number} latest status is "${latestNote.status}", not "${targetStatus}"`
        );
      }
    }

    logger.info(
      `Step 3: Found ${validOrders.length} orders with latest status "${targetStatus}"`
    );

    if (validOrders.length > 0) {
      logger.info(
        "Valid orders:",
        validOrders.map((o) => ({
          id: o.id,
          shopify_order_number: o.shopify_order_number,
        }))
      );
    }
  } catch (error) {
    logger.error("Debug failed:", error);
  }
}

debugGetOrders();
