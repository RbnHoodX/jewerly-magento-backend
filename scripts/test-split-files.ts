// Test script to verify the split files structure
import * as fs from "fs";
import * as path from "path";

const migrationDir = path.join(__dirname, "../migration");

console.log("🔍 Testing split files structure...");
console.log(`Migration directory: ${migrationDir}`);

// Check if migration directory exists
if (!fs.existsSync(migrationDir)) {
  console.error(`❌ Migration directory not found: ${migrationDir}`);
  process.exit(1);
}

// List all files in migration directory
const files = fs.readdirSync(migrationDir);
console.log(`📁 Found ${files.length} files in migration directory:`);
files.forEach((file) => {
  const filePath = path.join(migrationDir, file);
  const stats = fs.statSync(filePath);
  console.log(`  - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
});

// Test reading each file
const testFiles = [
  "main_page.csv",
  "Customer Notes.csv",
  "Diamonds.csv",
  "casting.csv",
  "3drelated.csv",
  "Employee Comments.xlsx",
];

console.log("\n📊 Testing file access:");
testFiles.forEach((fileName) => {
  const filePath = path.join(migrationDir, fileName);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${fileName} - ${(stats.size / 1024).toFixed(2)} KB`);

    // Test reading first few lines for CSV files
    if (fileName.endsWith(".csv")) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").slice(0, 3);
        console.log(`   First line: ${lines[0].substring(0, 100)}...`);
      } catch (error) {
        console.log(`   ❌ Error reading: ${error}`);
      }
    }
  } else {
    console.log(`❌ ${fileName} - Not found`);
  }
});

console.log("\n✅ File structure test completed!");

