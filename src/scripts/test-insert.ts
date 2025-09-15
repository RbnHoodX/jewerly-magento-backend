import { config } from "dotenv";
config();

import { createClient } from "@supabase/supabase-js";
import { Logger } from "../utils/logger";

const logger = new Logger("TestInsert");

async function testInsert() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    logger.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get the first order
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .limit(1);

    if (ordersError || !orders || orders.length === 0) {
      logger.error("No orders found");
      return;
    }

    const orderId = orders[0].id;
    logger.info(`Testing insert with order ID: ${orderId}`);

    // Try different column combinations to find the correct structure
    const testCases = [
      {
        name: "Minimal - just order_id and status",
        data: {
          order_id: orderId,
          status: "Casting Order",
        },
      },
      {
        name: "With content field",
        data: {
          order_id: orderId,
          status: "Casting Order",
          content: "Test note content",
        },
      },
      {
        name: "With note field",
        data: {
          order_id: orderId,
          status: "Casting Order",
          note: "Test note content",
        },
      },
      {
        name: "With created_at",
        data: {
          order_id: orderId,
          status: "Casting Order",
          content: "Test note content",
          created_at: new Date().toISOString(),
        },
      },
    ];

    for (const testCase of testCases) {
      logger.info(`Testing: ${testCase.name}`);

      try {
        const { data, error } = await supabase
          .from("order_customer_notes")
          .insert(testCase.data)
          .select()
          .single();

        if (error) {
          logger.info(`  ❌ Failed: ${error.message}`);
        } else {
          logger.info(`  ✅ Success! Record created:`, data);

          // Clean up the test record
          await supabase
            .from("order_customer_notes")
            .delete()
            .eq("id", data.id);
          logger.info(`  🧹 Cleaned up test record`);
          break; // Stop after first successful insert
        }
      } catch (err) {
        logger.info(`  ❌ Exception: ${err}`);
      }
    }
  } catch (error) {
    logger.error("Test failed:", error);
  }
}

testInsert();
