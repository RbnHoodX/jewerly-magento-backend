#!/usr/bin/env tsx
// Quick runner script for ultra-fast order import
// Usage: npm run import-orders-ultra

import "dotenv/config";
import { UltraFastOrderImporterV2 } from "./import-orders-ultra-fast-v2";

async function main() {
  console.log("🚀 Starting Ultra-Fast Order Import v2.0");
  console.log("=" * 50);
  
  try {
    const importer = new UltraFastOrderImporterV2();
    await importer.importAllData();
    
    console.log("\n🎉 Import completed successfully!");
    console.log("📊 Check the logs above for detailed performance metrics.");
    
  } catch (error) {
    console.error("\n💥 Import failed:", error);
    process.exit(1);
  }
}

// Run the import
main();
