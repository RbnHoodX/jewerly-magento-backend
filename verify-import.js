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

async function verifyImport() {
  console.log("🔍 Verifying import results...");
  console.log("=".repeat(50));

  try {
    // Check customers count
    const { count: customersCount, error: customersError } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    
    if (customersError) throw customersError;
    console.log(`👥 Customers: ${customersCount}`);

    // Check orders count
    const { count: ordersCount, error: ordersError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });
    
    if (ordersError) throw ordersError;
    console.log(`📦 Orders: ${ordersCount}`);

    // Check order items count
    const { count: orderItemsCount, error: orderItemsError } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true });
    
    if (orderItemsError) throw orderItemsError;
    console.log(`🛍️  Order Items: ${orderItemsCount}`);

    // Check 3D related count
    const { count: threeDCount, error: threeDError } = await supabase
      .from("order_3d_related")
      .select("*", { count: "exact", head: true });
    
    if (threeDError) throw threeDError;
    console.log(`🎨 3D Related: ${threeDCount}`);

    // Check for orders with order_id
    const { count: ordersWithOrderId, error: orderIdError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .not("order_id", "is", null);
    
    if (orderIdError) throw orderIdError;
    console.log(`📋 Orders with order_id: ${ordersWithOrderId}`);

    // Check for orders with shopify_order_number
    const { count: ordersWithShopifyNumber, error: shopifyError } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .not("shopify_order_number", "is", null);
    
    if (shopifyError) throw shopifyError;
    console.log(`🛒 Orders with shopify_order_number: ${ordersWithShopifyNumber}`);

    // Check for order items with proper image URLs
    const { count: orderItemsWithImages, error: imagesError } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .not("image", "is", null)
      .like("image", "https://%");
    
    if (imagesError) throw imagesError;
    console.log(`🖼️  Order Items with proper image URLs: ${orderItemsWithImages}`);

    // Check for 3D related with proper image URLs
    const { count: threeDWithImages, error: threeDImagesError } = await supabase
      .from("order_3d_related")
      .select("*", { count: "exact", head: true })
      .not("image_url", "is", null)
      .like("image_url", "https://%");
    
    if (threeDImagesError) throw threeDImagesError;
    console.log(`🎨 3D Related with proper image URLs: ${threeDWithImages}`);

    console.log("\n" + "=".repeat(50));
    console.log("✅ Import verification completed!");
    
    // Expected counts from CSV files
    console.log("\n📊 Expected vs Actual:");
    console.log(`Main CSV: 53,997 records → Orders: ${ordersCount}`);
    console.log(`3D Related CSV: 16,069 records → 3D Related: ${threeDCount}`);
    
    if (ordersCount >= 50000) {
      console.log("🎉 SUCCESS: Import appears to be complete!");
    } else {
      console.log("⚠️  WARNING: Import may be incomplete");
    }

  } catch (error) {
    console.error("❌ Error verifying import:", error);
    throw error;
  }
}

verifyImport();
