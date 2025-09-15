// Manual parsing test to understand the data structure

import { config } from "dotenv";

// Load environment variables
config();

async function manualParseTest() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Manual parsing test...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");

    console.log("Total lines:", lines.length);
    console.log("\nAnalyzing data structure...\n");

    // Look for the actual data rows by finding lines that start with known status names
    const knownStatuses = [
      "Casting Order",
      "Casting Received",
      "Polishing & Finishing",
      "Return For Refund Instructions",
      "Return for replacement instructions",
      "Return For Refund Received",
      "Return for replacement received",
      "Item Shipped",
      "Casting Order Email Sent",
      "Casting Order Delay - Jenny",
    ];

    const dataRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const status of knownStatuses) {
        if (line.startsWith(status + ",")) {
          dataRows.push(line);
          console.log(`Found data row ${dataRows.length}: ${status}`);
          break;
        }
      }
    }

    console.log(`\nFound ${dataRows.length} data rows`);

    // Parse each data row
    console.log("\nParsed data rows:");
    console.log("=".repeat(80));

    dataRows.forEach((row, index) => {
      const fields = row.split(",");
      console.log(`\nRow ${index + 1}:`);
      console.log(`  Status: "${fields[0]}"`);
      console.log(`  New Status: "${fields[1]}"`);
      console.log(`  Wait Time: "${fields[2]}"`);
      console.log(`  Description: "${fields[3]}"`);
      console.log(`  Private Email: "${fields[4]}"`);
      console.log(`  Email Subject: "${fields[5]}"`);
      console.log(`  Email Custom Message: "${fields[6]}"`);
      console.log(`  Additional Recipients: "${fields[7]}"`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

manualParseTest();
