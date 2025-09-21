// Script to import diamond inventory data from Excel file to Supabase

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Logger } from "../src/utils/logger";
import * as XLSX from "xlsx";
import * as path from "path";

const logger = new Logger("ImportDiamondsInventory");

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase configuration missing");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface ExcelDiamondData {
  ID: number;
  "Parcel Name": string;
  Shape: string;
  Carat: string | number;
  Color: string;
  Clarity: string;
  Stones: number;
  "Tot. CT Weight": number;
  "Minimum level": number | string;
  "Price Per CT": string | number;
  "Tot. Price": string | number;
}

interface DiamondInsertData {
  parcel_id: string;
  parcel_name: string;
  shape: string;
  carat_category: string;
  color: string;
  clarity: string;
  number_of_stones: number;
  total_carat: number;
  price_per_ct: number;
  is_parent: boolean;
  parent_parcel_id?: string;
  // Additional required fields
  pct: number;
  ws_price_per_ct: number;
  polish_symmetry: string;
  table_width: number;
  depth: number;
  girdle: string;
  fluorescence: string;
  culet: string;
  mm: number;
  certificate_type: string;
  days_active: number;
  is_editable: boolean;
}

function parsePrice(priceStr: string | number): number {
  // Handle both string and number inputs
  if (typeof priceStr === "number") {
    return priceStr;
  }
  if (typeof priceStr === "string") {
    // Remove $ and commas, then parse as float
    return parseFloat(priceStr.replace(/[$,]/g, ""));
  }
  return 0;
}

function parseCaratCategory(caratStr: string | number): string {
  // Convert carat string/number to category
  const caratString = String(caratStr);
  if (caratString.includes("-Less")) {
    return caratString.replace("-Less", "");
  }
  if (caratString.includes("-")) {
    return caratString;
  }
  return caratString;
}

function parseMinimumLevel(minLevel: number | string): number | undefined {
  if (typeof minLevel === "number") {
    return minLevel;
  }
  if (typeof minLevel === "string" && minLevel.trim() !== "") {
    const parsed = parseFloat(minLevel);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

async function importDiamondsInventory() {
  try {
    logger.log("info", "Starting diamond inventory import");

    // Read Excel file
    const excelPath = path.join(process.cwd(), "diamonds_inventory.xlsx");
    logger.log("info", `Reading Excel file: ${excelPath}`);

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelDiamondData[];

    logger.log("info", `Found ${jsonData.length} rows in Excel file`);

    // Transform data
    const diamondsData: DiamondInsertData[] = jsonData.map((row) => {
      const parcelId = `${row.ID}`;
      const caratCategory = row.Carat;
      const pricePerCt = parsePrice(row["Price Per CT"]);
      const totalPrice = parsePrice(row["Tot. Price"]);

      return {
        parcel_id: parcelId,
        parcel_name: String(row["Parcel Name"]),
        shape: row.Shape,
        carat_category: caratCategory,
        color: row.Color,
        clarity: row.Clarity,
        number_of_stones: row.Stones,
        total_carat: row["Tot. CT Weight"],
        price_per_ct: pricePerCt,
        is_parent: true, // All imported diamonds are parent parcels
        parent_parcel_id: null,
        // Additional required fields with default values
        pct: pricePerCt, // Use price_per_ct as pct
        ws_price_per_ct: pricePerCt * 0.8, // Wholesale price (80% of retail)
        polish_symmetry: "Good", // Default value
        table_width: 0, // Default value
        depth: 0, // Default value
        girdle: "Medium", // Default value
        fluorescence: "None", // Default value
        culet: "None", // Default value
        mm: 0, // Default value
        certificate_type: "None", // Default value
        days_active: 0, // Default value
        is_editable: true, // Default value
      };
    });

    logger.log("info", "Transformed data", {
      sample: diamondsData[0],
      totalRecords: diamondsData.length,
    });

    // Check if diamond_inventory table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from("diamond_inventory")
      .select("id")
      .limit(1);

    if (tableError) {
      logger.log(
        "error",
        "Diamonds inventory table does not exist or is not accessible",
        {
          error: tableError,
        }
      );
      throw new Error(`Table error: ${tableError.message}`);
    }

    // Clear existing data (optional - comment out if you want to keep existing data)
    logger.log("info", "Clearing existing diamond inventory data...");
    const { error: deleteError } = await supabase
      .from("diamond_inventory")
      .delete()
      .not("id", "is", null); // Delete all records

    if (deleteError) {
      logger.log("warn", "Failed to clear existing data", {
        error: deleteError,
      });
    } else {
      logger.log("info", "Existing data cleared");
    }

    // Insert data in batches
    const batchSize = 100;
    let insertedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < diamondsData.length; i += batchSize) {
      const batch = diamondsData.slice(i, i + batchSize);

      logger.log(
        "info",
        `Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          diamondsData.length / batchSize
        )}`
      );

      const { data, error } = await supabase
        .from("diamond_inventory")
        .insert(batch)
        .select("id");

      if (error) {
        logger.log("error", `Failed to insert batch starting at index ${i}`, {
          error: error,
          batchSize: batch.length,
        });
        errorCount += batch.length;
      } else {
        insertedCount += data?.length || 0;
        logger.log(
          "info",
          `Successfully inserted ${data?.length || 0} records`
        );
      }
    }

    logger.log("info", "Import completed", {
      totalRecords: diamondsData.length,
      insertedRecords: insertedCount,
      errorRecords: errorCount,
    });

    // Verify the import
    const { data: verifyData, error: verifyError } = await supabase
      .from("diamond_inventory")
      .select("id, parcel_id, parcel_name, shape, total_carat, price_per_ct")
      .limit(5);

    if (verifyError) {
      logger.log("error", "Failed to verify import", { error: verifyError });
    } else {
      logger.log("info", "Sample imported data:", { sample: verifyData });
    }
  } catch (error) {
    logger.log("error", "Import failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Run the import
importDiamondsInventory()
  .then(() => {
    logger.log("info", "Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.log("error", "Script failed", { error });
    process.exit(1);
  });
