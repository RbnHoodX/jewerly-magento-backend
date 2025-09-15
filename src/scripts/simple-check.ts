// Simple check of imported data

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config();

async function simpleCheck() {
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
    console.log("🔍 Checking imported data...\n");

    const { data, error } = await supabase
      .from("statuses_model")
      .select("status, new_status, wait_time_business_days")
      .order("status");

    if (error) {
      console.error("❌ Error:", error);
      return;
    }

    console.log(`✅ Found ${data?.length || 0} records\n`);

    if (data && data.length > 0) {
      data.forEach((record, index) => {
        console.log(
          `${index + 1}. ${record.status} → ${record.new_status} (${
            record.wait_time_business_days
          } days)`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

simpleCheck();
