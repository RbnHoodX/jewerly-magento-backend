// Test the correct parser approach

import { config } from "dotenv";

// Load environment variables
config();

async function testCorrectParser() {
  try {
    const url =
      "https://docs.google.com/spreadsheets/d/1V6saLTLhDVGG8HV9DyqZm9xnW5V4KESvk-IFZxCwWmQ/export?format=csv&gid=0";

    console.log("🔍 Testing correct parser approach...\n");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch CSV: ${response.status} ${response.statusText}`
      );
    }

    const csvText = await response.text();

    // Use a completely different approach - parse the CSV manually
    const rows = parseCSVCorrectly(csvText);

    console.log(`✅ Parsed ${rows.length} rows`);

    // Display the data
    rows.forEach((row, index) => {
      console.log(`\n${index + 1}. ${row[0]} → ${row[1]}`);
      console.log(`   Wait Time: ${row[2]}`);
      if (row[4]) console.log(`   Private Email: ${row[4]}`);
      if (row[5]) console.log(`   Email Subject: ${row[5]}`);
      if (row[6])
        console.log(`   Email Custom Message: ${row[6].substring(0, 100)}...`);
    });
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

function parseCSVCorrectly(csvText: string): string[][] {
  const lines = csvText.split("\n");
  const rows: string[][] = [];

  // Get header row
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  rows.push(headers);

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
  let i = 1;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    // Check if this line starts with a known status
    for (const status of knownStatuses) {
      if (line.startsWith(status + ",")) {
        // This is a data row, parse it with multi-line handling
        const { rowData, nextIndex } = parseDataRowCorrectly(
          lines,
          i,
          knownStatuses
        );
        if (rowData) {
          rows.push(rowData);
        }
        i = nextIndex;
        break;
      }
    }
    i++;
  }

  return rows;
}

function parseDataRowCorrectly(
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
      if (!emailCustomMessage) {
        emailCustomMessage = nextLine;
      } else {
        emailCustomMessage += "\n" + nextLine;
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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

testCorrectParser();
