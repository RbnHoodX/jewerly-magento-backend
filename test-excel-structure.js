import ExcelJS from "exceljs";
import path from "path";

const MIGRATION_DIR = path.join(process.cwd(), "migration");

async function testExcelStructure() {
  console.log("🔍 TESTING EXCEL STRUCTURE");
  console.log("=".repeat(50));

  try {
    const excelPath = path.join(MIGRATION_DIR, "Employee Comments.xlsx");
    console.log(`📁 Reading Excel file: ${excelPath}`);
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    
    const worksheet = workbook.worksheets[0];
    console.log(`📊 Sheet name: ${worksheet.name}`);
    console.log(`📊 Row count: ${worksheet.rowCount}`);
    console.log(`📊 Column count: ${worksheet.columnCount}`);

    // Get headers from first row
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers.push(cell.value);
    });
    
    console.log(`📊 Headers: ${headers.join(', ')}`);
    
    // Check a few sample rows
    console.log("\n🔍 Sample rows:");
    for (let rowNum = 2; rowNum <= Math.min(5, worksheet.rowCount); rowNum++) {
      const row = worksheet.getRow(rowNum);
      const rowData = {};
      
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rowData[header] = cell.value;
        }
      });
      
      console.log(`\n  Row ${rowNum}:`, {
        'Order #': rowData['Order #'],
        'Employee Names': rowData['Employee Names'],
        'Comment': rowData['Comment']?.toString().substring(0, 50) + '...',
        'File Attachment 1': rowData['File Attachment 1'],
        'File Attachment 2': rowData['File Attachment 2']
      });
      
      // Check for hyperlinks in this row
      row.eachCell((cell, colNumber) => {
        if (cell.hyperlink) {
          console.log(`    🔗 Hyperlink in col ${colNumber}: ${cell.hyperlink}`);
        }
        if (cell.value && cell.value.formula && cell.value.formula.startsWith("HYPERLINK(")) {
          console.log(`    🔗 HYPERLINK formula in col ${colNumber}: ${cell.value.formula}`);
        }
      });
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testExcelStructure();
