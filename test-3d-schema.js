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

async function test3DSchema() {
  console.log("🧪 Testing order_3d_related table schema...");
  
  try {
    // Try to insert a minimal record to see what columns are required
    const { data, error } = await supabase
      .from("order_3d_related")
      .insert({
        order_id: "test-order-id",
        image_url: "test-image.jpg"
      })
      .select();

    if (error) {
      console.log("❌ Error inserting test record:", error.message);
      console.log("📊 This tells us what columns are required");
    } else {
      console.log("✅ Test record inserted successfully:", data);
    }
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

test3DSchema();
