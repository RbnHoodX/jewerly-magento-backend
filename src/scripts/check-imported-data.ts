// Script to check imported status model data

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config();

async function checkImportedData() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase configuration missing");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    console.log("🔍 Checking imported status model data...\n");

    const { data, error } = await supabase
      .from("statuses_model")
      .select("*")
      .order("status");

    if (error) {
      console.error("❌ Error fetching data:", error);
      return;
    }

    console.log(
      `✅ Found ${data?.length || 0} records in statuses_model table\n`
    );

    if (data && data.length > 0) {
      console.log("📋 Status Model Data:");
      console.log("=".repeat(80));

      data.forEach((record, index) => {
        console.log(`${index + 1}. ${record.status} → ${record.new_status}`);
        console.log(
          `   Wait Time: ${record.wait_time_business_days} business days`
        );
        console.log(`   Description: ${record.description}`);
        if (record.email_subject) {
          console.log(`   Email Subject: ${record.email_subject}`);
        }
        if (record.private_email) {
          console.log(`   Private Email: ${record.private_email}`);
        }
        console.log(`   Active: ${record.is_active ? "Yes" : "No"}`);
        console.log("");
      });
    } else {
      console.log("❌ No data found in statuses_model table");
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkImportedData();
