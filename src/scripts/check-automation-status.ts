import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config();

async function checkAutomationStatus() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase configuration missing");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("🔍 Checking automation system status...\n");

  try {
    // Check status rules
    console.log("📋 Checking status rules...");
    const { data: statusRules, error: statusError } = await supabase
      .from("statuses_model")
      .select("*")
      .eq("is_active", true);

    if (statusError) {
      console.error("❌ Error fetching status rules:", statusError);
    } else {
      console.log(`✅ Found ${statusRules?.length || 0} active status rules`);
      if (statusRules && statusRules.length > 0) {
        console.log("📝 Sample rules:");
        statusRules.slice(0, 3).forEach((rule, index) => {
          console.log(`   ${index + 1}. ${rule.status} → ${rule.new_status} (${rule.wait_time_business_days} days)`);
        });
      }
    }

    // Check orders with customer notes
    console.log("\n📦 Checking orders with customer notes...");
    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("id, shopify_order_number")
      .limit(5);

    if (ordersError) {
      console.error("❌ Error fetching orders:", ordersError);
    } else {
      console.log(`✅ Found ${orders?.length || 0} orders`);
    }

    // Check customer notes
    console.log("\n📝 Checking customer notes...");
    const { data: notes, error: notesError } = await supabase
      .from("order_customer_notes")
      .select("id, order_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (notesError) {
      console.error("❌ Error fetching customer notes:", notesError);
    } else {
      console.log(`✅ Found ${notes?.length || 0} customer notes`);
      if (notes && notes.length > 0) {
        console.log("📝 Recent notes:");
        notes.slice(0, 3).forEach((note, index) => {
          console.log(`   ${index + 1}. Order ${note.order_id}: ${note.status} (${note.created_at})`);
        });
      }
    }

    // Check email logs
    console.log("\n📧 Checking email logs...");
    const { data: emailLogs, error: emailError } = await supabase
      .from("email_logs")
      .select("id, order_id, email_type, recipient_email, status, sent_at")
      .order("sent_at", { ascending: false })
      .limit(10);

    if (emailError) {
      console.error("❌ Error fetching email logs:", emailError);
    } else {
      console.log(`✅ Found ${emailLogs?.length || 0} email logs`);
      if (emailLogs && emailLogs.length > 0) {
        console.log("📧 Recent emails:");
        emailLogs.slice(0, 3).forEach((log, index) => {
          console.log(`   ${index + 1}. ${log.recipient_email}: ${log.status} (${log.sent_at})`);
        });
      }
    }

  } catch (error) {
    console.error("❌ Error checking automation status:", error);
  }
}

checkAutomationStatus().catch(console.error);
