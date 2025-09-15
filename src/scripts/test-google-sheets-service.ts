// Test GoogleSheetsService directly

import { config } from "dotenv";
import { GoogleSheetsService } from "../services/googleSheetsFixed";

// Load environment variables
config();

async function testGoogleSheetsService() {
  try {
    console.log("🔍 Testing GoogleSheetsService directly...\n");

    const service = new GoogleSheetsService();
    const result = await service.importStatusModel(
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/edit?gid=0#gid=0"
    );

    console.log(
      `✅ GoogleSheetsService returned ${result.data.length} records`
    );

    // Display the data
    result.data.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row.status} → ${row.new_status}`);
      console.log(`   Wait Time: ${row.wait_time_business_days}`);
      if (row.private_email)
        console.log(`   Private Email: ${row.private_email}`);
      if (row.email_subject)
        console.log(`   Email Subject: ${row.email_subject}`);
      if (row.email_custom_message)
        console.log(
          `   Email Custom Message: ${row.email_custom_message.substring(
            0,
            100
          )}...`
        );
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testGoogleSheetsService();
