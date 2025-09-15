// Debug script to see all lines and identify why some rows are missing

import { config } from "dotenv";

// Load environment variables
config();

async function debugAllLines() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Debugging all lines...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");

    console.log("Total lines:", lines.length);
    console.log("\nAll lines with line numbers:");
    console.log("=".repeat(80));

    lines.forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });

    console.log("\n" + "=".repeat(80));

    // Known status names to identify data rows
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

    console.log("\nLooking for data rows:");
    console.log("=".repeat(80));

    let foundRows = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      for (const status of knownStatuses) {
        if (line.startsWith(status + ",")) {
          foundRows++;
          console.log(`Found row ${foundRows} at line ${i + 1}: ${status}`);
          console.log(`  Full line: ${line}`);
          break;
        }
      }
    }

    console.log(`\n✅ Total found: ${foundRows} rows`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

debugAllLines();
