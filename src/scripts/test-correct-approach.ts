// Test the correct approach

import { config } from "dotenv";
import Papa from "papaparse";

// Load environment variables
config();

async function testCorrectApproach() {
  try {
    const url = "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";
    
    console.log("🔍 Testing correct approach...\n");
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
    }
    
    const csvText = await response.text();
    
    // Parse with Papa Parse
    const result = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
    });
    
    console.log(`✅ Papa Parse parsed ${result.data.length} rows`);
    
    // Filter out the header row and get only valid data rows
    const dataRows = result.data.slice(1);
    
    // Known status names to identify valid data rows
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
    
    const validRows = dataRows.filter(row => {
      const status = row[0]?.trim();
      return status && knownStatuses.includes(status);
    });
    
    console.log(`✅ Found ${validRows.length} valid data rows`);
    
    // Display the valid data
    validRows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row[0]} → ${row[1]}`);
      console.log(`   Wait Time: ${row[2]}`);
      if (row[4]) console.log(`   Private Email: ${row[4]}`);
      if (row[5]) console.log(`   Email Subject: ${row[5]}`);
      if (row[6]) console.log(`   Email Custom Message: ${row[6].substring(0, 100)}...`);
    });
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testCorrectApproach();
