import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
config();

interface Customer {
  id: string;
  email: string;
  customer_id?: string;
  created_at: string;
}

async function backfillCustomerIds() {
  console.log("🔄 Starting customer ID backfill process...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
    );
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all customers without customer_id, ordered by creation date
    const { data: customers, error: fetchError } = await supabase
      .from("customers")
      .select("id, email, created_at")
      .is("customer_id", null)
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("❌ Error fetching customers:", fetchError);
      return;
    }

    if (!customers || customers.length === 0) {
      console.log("✅ No customers need customer_id backfill");
      return;
    }

    console.log(`📊 Found ${customers.length} customers to backfill`);

    // Get the highest existing customer_id to continue from there
    const { data: existingCustomers, error: existingError } = await supabase
      .from("customers")
      .select("customer_id")
      .not("customer_id", "is", null)
      .order("customer_id", { ascending: false })
      .limit(1);

    let nextCustomerId = 1;
    if (!existingError && existingCustomers && existingCustomers.length > 0) {
      const highestId = existingCustomers[0].customer_id;
      if (highestId) {
        nextCustomerId = parseInt(highestId, 10) + 1;
      }
    }

    console.log(
      `🆔 Starting customer ID generation from: ${nextCustomerId
        .toString()
        .padStart(6, "0")}`
    );

    // Process customers in batches
    const batchSize = 10;
    for (let i = 0; i < customers.length; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);

      console.log(
        `\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          customers.length / batchSize
        )}`
      );

      const updates = batch.map((customer, index) => {
        const customerId = (nextCustomerId + i + index)
          .toString()
          .padStart(6, "0");
        return {
          id: customer.id,
          customer_id: customerId,
        };
      });

      // Update customers with generated IDs
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from("customers")
          .update({ customer_id: update.customer_id })
          .eq("id", update.id);

        if (updateError) {
          console.error(
            `❌ Error updating customer ${update.id}:`,
            updateError
          );
        } else {
          console.log(
            `✅ Updated customer ${update.id} with customer_id: ${update.customer_id}`
          );
        }
      }
    }

    console.log("\n🎉 Customer ID backfill completed successfully!");

    // Verify the results
    const { data: verifyData, error: verifyError } = await supabase
      .from("customers")
      .select("id, email, customer_id")
      .not("customer_id", "is", null)
      .order("customer_id", { ascending: true })
      .limit(5);

    if (!verifyError && verifyData) {
      console.log("\n📋 Sample of updated customers:");
      verifyData.forEach((customer) => {
        console.log(`  ${customer.customer_id} - ${customer.email}`);
      });
    }
  } catch (error) {
    console.error("❌ Unexpected error during backfill:", error);
  }
}

// Run the backfill
backfillCustomerIds().catch(console.error);
