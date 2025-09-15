// Test Papa Parse with all rows

import { config } from "dotenv";
import Papa from "papaparse";

// Load environment variables
config();

async function testPapaParseFull() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Testing Papa Parse with all rows...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();

    // Parse with Papa Parse
    const result = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });

    console.log(`✅ Papa Parse parsed ${result.data.length} rows`);

    if (result.errors.length > 0) {
      console.log("⚠️ Papa Parse errors:");
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message} (Row ${error.row})`);
      });
    }

    console.log("\nAll rows:");
    console.log("=".repeat(80));

    result.data.forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      console.log(`  Status: "${row[0]}"`);
      console.log(`  New Status: "${row[1]}"`);
      console.log(`  Wait Time: "${row[2]}"`);
      if (row[4]) console.log(`  Private Email: "${row[4]}"`);
      if (row[5]) console.log(`  Email Subject: "${row[5]}"`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testPapaParseFull();
