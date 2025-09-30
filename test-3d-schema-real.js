import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase configuration missing");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

async function test3DSchemaWithRealOrder() {
  console.log("🧪 Testing order_3d_related table schema with real order...");
  
  try {
    // Get a real order ID
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .limit(1);

    if (ordersError || !orders || orders.length === 0) {
      console.log("❌ No orders found");
      return;
    }

    const orderId = orders[0].id;
    console.log("📊 Using order ID:", orderId);

    // Try to insert a minimal record
    const { data, error } = await supabase
      .from("order_3d_related")
      .insert({
        order_id: orderId,
        image_url: "test-image.jpg"
      })
      .select();

    if (error) {
      console.log("❌ Error inserting test record:", error.message);
      console.log("📊 This tells us what columns are required");
    } else {
      console.log("✅ Test record inserted successfully:", data);
      
      // Clean up the test record
      await supabase
        .from("order_3d_related")
        .delete()
        .eq("order_id", orderId);
      console.log("🧹 Test record cleaned up");
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test3DSchemaWithRealOrder();
