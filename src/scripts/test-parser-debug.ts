// Test parser with debug output

import { config } from "dotenv";

// Load environment variables
config();

async function testParserDebug() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Testing parser with debug output...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");

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

    // Find and parse data rows
    const dataRows: any[] = [];
    let i = 1;

    console.log("Starting to parse data rows...\n");

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      console.log(`Checking line ${i + 1}: ${line.substring(0, 50)}...`);

      // Check if this line starts with a known status
      for (const status of knownStatuses) {
        if (line.startsWith(status + ",")) {
          console.log(`  ✓ Found data row: ${status}`);

          // Parse this row with multi-line handling
          const { rowData, nextIndex } = parseDataRowWithMultiLine(
            lines,
            i,
            knownStatuses
          );
          if (rowData) {
            dataRows.push(rowData);
            console.log(`  ✓ Parsed: ${rowData[0]} → ${rowData[1]}`);
          }
          i = nextIndex;
          console.log(`  → Next index: ${i}\n`);
          break;
        }
      }
      i++;
    }

    console.log(`\n✅ Found ${dataRows.length} data rows`);

    // Display parsed data
    console.log("\nParsed data:");
    console.log("=".repeat(80));

    dataRows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row[0]} → ${row[1]}`);
      console.log(`   Wait Time: ${row[2]}`);
      console.log(`   Description: ${row[3]}`);
      if (row[4]) console.log(`   Private Email: ${row[4]}`);
      if (row[5]) console.log(`   Email Subject: ${row[5]}`);
      if (row[6])
        console.log(`   Email Custom Message: ${row[6].substring(0, 100)}...`);
      if (row[7]) console.log(`   Additional Recipients: ${row[7]}`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

function parseDataRowWithMultiLine(
  allLines: string[],
  startIndex: number,
  knownStatuses: string[]
): { rowData: string[] | null; nextIndex: number } {
  try {
    const startLine = allLines[startIndex];
    const initialFields = startLine.split(",");

    // Expected fields: Status, New Status, Wait Time, Description, Private Email, Email Subject, Email Custom Message, Additional Recipients
    const row = new Array(8).fill("");

    // Fill in the fields we can get from the first line
    row[0] = initialFields[0] || ""; // Status
    row[1] = initialFields[1] || ""; // New Status
    row[2] = initialFields[2] || ""; // Wait Time
    row[3] = initialFields[3] || ""; // Description
    row[4] = initialFields[4] || ""; // Private Email
    row[5] = initialFields[5] || ""; // Email Subject

    // Handle Email Custom Message and Additional Recipients
    let emailCustomMessage = "";
    let additionalRecipients = "";

    // Check if we have more fields in the first line
    if (initialFields.length > 6) {
      emailCustomMessage = initialFields[6] || "";
      if (initialFields.length > 7) {
        additionalRecipients = initialFields[7] || "";
      }
    }

    // Look for multi-line content in subsequent lines
    let currentIndex = startIndex + 1;
    let inEmailMessage = false;
    let inAdditionalRecipients = false;

    while (currentIndex < allLines.length) {
      const nextLine = allLines[currentIndex].trim();

      if (!nextLine) {
        currentIndex++;
        continue;
      }

      // Check if this is the start of another data row
      const isNextDataRow = knownStatuses.some((status) =>
        nextLine.startsWith(status + ",")
      );
      if (isNextDataRow) {
        break;
      }

      // This is part of the current row's multi-line content
      if (!inEmailMessage && !inAdditionalRecipients) {
        // This is likely part of the email custom message
        emailCustomMessage += (emailCustomMessage ? "\n" : "") + nextLine;
        inEmailMessage = true;
      } else if (inEmailMessage && !inAdditionalRecipients) {
        // Check if this looks like additional recipients (has email-like content)
        if (
          nextLine.includes("@") ||
          nextLine.includes("email") ||
          nextLine.includes("recipient")
        ) {
          additionalRecipients = nextLine;
          inAdditionalRecipients = true;
        } else {
          emailCustomMessage += "\n" + nextLine;
        }
      } else {
        additionalRecipients += "\n" + nextLine;
      }

      currentIndex++;
    }

    row[6] = emailCustomMessage.trim();
    row[7] = additionalRecipients.trim();

    return { rowData: row, nextIndex: currentIndex };
  } catch (error) {
    console.error("Error parsing data row:", error);
    return { rowData: null, nextIndex: startIndex + 1 };
  }
}

testParserDebug();
