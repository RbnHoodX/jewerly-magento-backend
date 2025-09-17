import { config } from "dotenv";
import { AutomationService } from "../services/automation";

// Load environment variables
config();

async function testWaitTimes() {
  console.log("🧪 Testing Wait Time Logic...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
    );
    return;
  }

  const automationService = new AutomationService(supabaseUrl, supabaseKey);

  // Test business days calculation
  console.log("\n📅 Testing Business Days Calculation:");

  const testCases = [
    {
      start: new Date("2025-01-15T10:00:00Z"), // Wednesday
      end: new Date("2025-01-16T10:00:00Z"), // Thursday
      expected: 1,
    },
    {
      start: new Date("2025-01-15T10:00:00Z"), // Wednesday
      end: new Date("2025-01-17T10:00:00Z"), // Friday
      expected: 2,
    },
    {
      start: new Date("2025-01-15T10:00:00Z"), // Wednesday
      end: new Date("2025-01-20T10:00:00Z"), // Monday
      expected: 3,
    },
    {
      start: new Date("2025-01-15T10:00:00Z"), // Wednesday
      end: new Date("2025-01-21T10:00:00Z"), // Tuesday
      expected: 4,
    },
    {
      start: new Date("2025-01-15T10:00:00Z"), // Wednesday
      end: new Date("2025-01-15T15:00:00Z"), // Same day
      expected: 0,
    },
  ];

  for (const testCase of testCases) {
    // Access the private method through type assertion
    const businessDays = (automationService as any).calculateBusinessDays(
      testCase.start,
      testCase.end
    );
    const passed = businessDays === testCase.expected;

    console.log(
      `${
        passed ? "✅" : "❌"
      } ${testCase.start.toDateString()} to ${testCase.end.toDateString()}: ${businessDays} days (expected: ${
        testCase.expected
      })`
    );
  }

  console.log("\n🔍 Testing Current Automation Status:");

  try {
    await automationService.runAutomation();
    console.log("✅ Automation completed successfully");
  } catch (error) {
    console.error("❌ Automation failed:", error);
  }
}

testWaitTimes().catch(console.error);
