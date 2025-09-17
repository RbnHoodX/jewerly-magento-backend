import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { DatabaseService } from "../services/database";

// Load environment variables
config();

async function testCustomerIdGeneration() {
  console.log("🧪 Testing customer ID generation...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
    );
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const dbService = new DatabaseService(supabase);

  try {
    // Test creating a new customer
    const testCustomerData = {
      email: `test-customer-${Date.now()}@example.com`,
      name: "Test Customer",
      first_name: "Test",
      last_name: "Customer",
    };

    console.log("📝 Creating test customer...");
    const customerId = await dbService.upsertCustomer(testCustomerData);

    if (customerId) {
      console.log("✅ Customer created successfully!");

      // Fetch the customer to verify customer_id was generated
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id, email, customer_id")
        .eq("id", customerId)
        .single();

      if (error) {
        console.error("❌ Error fetching customer:", error);
      } else {
        console.log("📋 Customer details:");
        console.log(`  ID: ${customer.id}`);
        console.log(`  Email: ${customer.email}`);
        console.log(`  Customer ID: ${customer.customer_id}`);

        if (customer.customer_id && /^\d{6}$/.test(customer.customer_id)) {
          console.log("✅ Customer ID format is correct (6 digits)");
        } else {
          console.log("❌ Customer ID format is incorrect");
        }
      }
    } else {
      console.log("❌ Failed to create customer");
    }

    // Test getting existing customers with customer_id
    console.log("\n📊 Checking existing customers with customer_id...");
    const { data: existingCustomers, error: fetchError } = await supabase
      .from("customers")
      .select("id, email, customer_id")
      .not("customer_id", "is", null)
      .order("customer_id", { ascending: true })
      .limit(5);

    if (fetchError) {
      console.error("❌ Error fetching existing customers:", fetchError);
    } else if (existingCustomers && existingCustomers.length > 0) {
      console.log("📋 Sample customers with customer_id:");
      existingCustomers.forEach((customer) => {
        console.log(`  ${customer.customer_id} - ${customer.email}`);
      });
    } else {
      console.log("ℹ️ No customers with customer_id found");
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run the test
testCustomerIdGeneration().catch(console.error);
