// Debug script to see the actual CSV data from Google Sheets

import { config } from "dotenv";

// Load environment variables
config();

async function debugCSV() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Fetching CSV data from Google Sheets...\n");
    console.log("URL:", url);
    console.log("=".repeat(80));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();

    console.log("Raw CSV Data:");
    console.log("=".repeat(80));
    console.log(csvText);
    console.log("=".repeat(80));

    // Split by lines to see the structure
    const lines = csvText.split("\n");
    console.log(`\nTotal lines: ${lines.length}`);
    console.log("\nFirst 10 lines:");
    lines.slice(0, 10).forEach((line, index) => {
      console.log(`${index + 1}: ${line}`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

debugCSV();
