// Test Papa Parse with the Google Sheets CSV

import { config } from "dotenv";
import Papa from "papaparse";

// Load environment variables
config();

async function testPapaParse() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Testing Papa Parse with Google Sheets CSV...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();

    console.log("Raw CSV (first 500 chars):");
    console.log(csvText.substring(0, 500));
    console.log("\n" + "=".repeat(80) + "\n");

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

    console.log("\nFirst 10 rows:");
    console.log("=".repeat(80));

    result.data.slice(0, 10).forEach((row, index) => {
      console.log(`\nRow ${index + 1}:`);
      console.log(`  Status: "${row[0]}"`);
      console.log(`  New Status: "${row[1]}"`);
      console.log(`  Wait Time: "${row[2]}"`);
      console.log(`  Description: "${row[3]}"`);
      console.log(`  Private Email: "${row[4]}"`);
      console.log(`  Email Subject: "${row[5]}"`);
      console.log(`  Email Custom Message: "${row[6]}"`);
      console.log(`  Additional Recipients: "${row[7]}"`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testPapaParse();
