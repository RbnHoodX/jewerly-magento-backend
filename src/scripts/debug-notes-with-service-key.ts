import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("DebugNotesWithServiceKey");

async function debugNotesWithServiceKey() {
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
    const targetStatus = "Casting Order";
    logger.info(
      `Debugging notes with service key for status: "${targetStatus}"`
    );

    // Get all orders
    const { data: allOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number, customer_id");

    if (ordersError) {
      logger.error("Error fetching orders:", ordersError);
      return;
    }

    logger.info(`Found ${allOrders?.length || 0} orders`);

    // Check each order for notes
    for (const order of allOrders || []) {
      logger.info(`Checking order ${order.shopify_order_number} (${order.id})`);

      // Get all notes for this order
      const { data: notes, error: notesError } = await supabase
        .from("order_customer_notes")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at", { ascending: false });

      if (notesError) {
        logger.error(
          `  Error fetching notes for order ${order.id}:`,
          notesError
        );
        continue;
      }

      logger.info(`  Found ${notes?.length || 0} notes for this order`);

      if (notes && notes.length > 0) {
        notes.forEach((note, index) => {
          logger.info(
            `    ${index + 1}. Status: "${note.status}", Content: "${
              note.content
            }"`
          );
        });

        // Check if latest note has target status
        const latestNote = notes[0];
        if (latestNote.status === targetStatus) {
          logger.info(
            `  ✅ Order ${order.shopify_order_number} has latest status "${targetStatus}"`
          );
        } else {
          logger.info(
            `  ❌ Order ${order.shopify_order_number} latest status is "${latestNote.status}", not "${targetStatus}"`
          );
        }
      }
    }
  } catch (error) {
    logger.error("Debug failed:", error);
  }
}

debugNotesWithServiceKey();
