// FINAL Data Cleaning Script for Production Import
// Handles ALL real-world data issues with comprehensive error handling

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

class FinalDataCleaner {
  private migrationDir: string;
  private cleanedDir: string;

  constructor() {
    this.migrationDir = path.join(__dirname, "../migration");
    this.cleanedDir = path.join(__dirname, "../migration/cleaned");
    
    // Create cleaned directory
    if (!fs.existsSync(this.cleanedDir)) {
      fs.mkdirSync(this.cleanedDir, { recursive: true });
    }
  }

  async cleanAllData(): Promise<void> {
    console.log("🧹 Starting FINAL data cleaning process...");
    console.log("=" * 60);

    try {
      // Clean all data files
      await this.cleanMainOrders();
      await this.cleanCustomerNotes();
      await this.cleanDiamonds();
      await this.cleanCasting();
      await this.cleanThreeD();
      await this.cleanEmployeeComments();

      console.log("\n✅ FINAL data cleaning completed successfully!");
      console.log("📁 Cleaned files saved to: migration/cleaned/");
      console.log("🚀 You can now run: npm run import-orders-production");

    } catch (error) {
      console.error("💥 Data cleaning failed:", error);
      throw error;
    }
  }

  private async cleanMainOrders(): Promise<void> {
    console.log("\n📦 Cleaning main orders data...");
    
    const filePath = path.join(this.migrationDir, "main_page.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Main orders file not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const ordersData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${ordersData.length} orders to clean`);

    // Clean the data - remove ALL problematic records
    const cleanedData = ordersData.filter(order => {
      // Remove orders with missing critical data
      if (!order["Order #"]) return false;
      if (!order["Customer Email"]) return false;
      
      const billingFirstName = this.safeString(order["Billing First Name:"]);
      const billingLastName = this.safeString(order["Billing Last Name"]);
      
      if (!billingFirstName || billingFirstName.trim() === "") return false;
      if (!billingLastName || billingLastName.trim() === "") return false;
      
      // Remove orders with empty dates
      const orderDate = this.safeString(order["Order Date"]);
      if (!orderDate || orderDate.trim() === "") return false;
      
      return true;
    }).map(order => {
      // Clean and normalize data
      return {
        ...order,
        "Customer Email": this.cleanEmail(order["Customer Email"]),
        "Billing First Name:": this.cleanName(order["Billing First Name:"]),
        "Billing Last Name": this.cleanName(order["Billing Last Name"]),
        "Shipping First Name:": this.cleanName(order["Shipping First Name:"] || order["Billing First Name:"]),
        "Shipping Last Name": this.cleanName(order["Shipping Last Name"] || order["Billing Last Name"]),
        "Order Date": this.cleanDate(order["Order Date"]),
        "Billing Tel": this.cleanPhone(order["Billing Tel"]),
        "Shipping Tel": this.cleanPhone(order["Shipping Tel"] || order["Billing Tel"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "main_page.csv");
    this.saveCSV(cleanedPath, cleanedData);
    
    console.log(`✅ Cleaned main orders: ${cleanedData.length} valid orders (removed ${ordersData.length - cleanedData.length} invalid)`);
  }

  private async cleanCustomerNotes(): Promise<void> {
    console.log("\n📝 Cleaning customer notes data...");
    
    const filePath = path.join(this.migrationDir, "Customer Notes.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Customer Notes.csv not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const notesData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${notesData.length} customer notes to clean`);

    // Clean the data
    const cleanedData = notesData.filter(note => {
      // Remove notes with missing critical data
      if (!note["Order #"]) return false;
      
      return true;
    }).map(note => {
      // Clean and normalize data
      return {
        ...note,
        "Order #": this.cleanOrderNumber(note["Order #"]),
        "Date Added": this.cleanDate(note["Date Added"]),
        "Comment": this.cleanText(note["Comment"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "Customer Notes.csv");
    this.saveCSV(cleanedPath, cleanedData);
    
    console.log(`✅ Cleaned customer notes: ${cleanedData.length} valid notes (removed ${notesData.length - cleanedData.length} invalid)`);
  }

  private async cleanDiamonds(): Promise<void> {
    console.log("\n💎 Cleaning diamonds data...");
    
    const filePath = path.join(this.migrationDir, "Diamonds.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Diamonds.csv not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const diamondsData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${diamondsData.length} diamond records to clean`);

    // Clean the data - only keep records with valid order numbers
    const cleanedData = diamondsData.filter(diamond => {
      // Remove diamonds with missing or invalid order numbers
      if (!diamond["Order #"]) return false;
      if (diamond["Order #"] === "0" || diamond["Order #"] === 0) return false;
      
      return true;
    }).map(diamond => {
      // Clean and normalize data
      return {
        ...diamond,
        "Order #": this.cleanOrderNumber(diamond["Order #"]),
        "Date Added": this.cleanDate(diamond["Date Added"]),
        "CT Weight": this.cleanAmount(diamond["CT Weight"]),
        "Total Price": this.cleanAmount(diamond["Total Price"]),
        "Price Per CT": this.cleanAmount(diamond["Price Per CT"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "Diamonds.csv");
    this.saveCSV(cleanedPath, cleanedData);
    
    console.log(`✅ Cleaned diamonds: ${cleanedData.length} valid records (removed ${diamondsData.length - cleanedData.length} invalid)`);
  }

  private async cleanCasting(): Promise<void> {
    console.log("\n🏭 Cleaning casting data...");
    
    const filePath = path.join(this.migrationDir, "casting.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  casting.csv not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const castingData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${castingData.length} casting records to clean`);

    // Clean the data - only keep records with valid order numbers
    const cleanedData = castingData.filter(casting => {
      // Remove casting with missing or invalid order numbers
      if (!casting["Order #"]) return false;
      if (casting["Order #"] === "0" || casting["Order #"] === 0) return false;
      
      return true;
    }).map(casting => {
      // Clean and normalize data
      return {
        ...casting,
        "Order #": this.cleanOrderNumber(casting["Order #"]),
        "Date Added": this.cleanDate(casting["Date Added"]),
        "Supplier": this.cleanText(casting["Supplier"]),
        "Metal Type": this.cleanText(casting["Metal Type"]),
        "Qty": this.cleanAmount(casting["Qty"]),
        "Weight": this.cleanAmount(casting["Weight"]),
        "Price": this.cleanAmount(casting["Price"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "casting.csv");
    this.saveCSV(cleanedPath, cleanedData);
    
    console.log(`✅ Cleaned casting: ${cleanedData.length} valid records (removed ${castingData.length - cleanedData.length} invalid)`);
  }

  private async cleanThreeD(): Promise<void> {
    console.log("\n🎨 Cleaning 3D related data...");
    
    const filePath = path.join(this.migrationDir, "3drelated.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  3drelated.csv not found");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const threeDData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${threeDData.length} 3D records to clean`);

    // Clean the data
    const cleanedData = threeDData.filter(threeD => {
      // Remove 3D records with missing critical data
      if (!threeD["Order #"]) return false;
      
      return true;
    }).map(threeD => {
      // Clean and normalize data
      return {
        ...threeD,
        "Order #": this.cleanOrderNumber(threeD["Order #"]),
        "Date": this.cleanDate(threeD["Date"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "3drelated.csv");
    this.saveCSV(cleanedPath, cleanedData);
    
    console.log(`✅ Cleaned 3D related: ${cleanedData.length} valid records (removed ${threeDData.length - cleanedData.length} invalid)`);
  }

  private async cleanEmployeeComments(): Promise<void> {
    console.log("\n💬 Cleaning employee comments data...");
    
    const filePath = path.join(this.migrationDir, "Employee Comments.xlsx");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Employee Comments.xlsx not found");
      return;
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const commentsData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${commentsData.length} employee comments to clean`);

    // Clean the data - only keep records with valid order numbers
    const cleanedData = commentsData.filter(comment => {
      // Remove comments with missing or invalid order numbers
      if (!comment["Order #"]) return false;
      if (comment["Order #"] === "0" || comment["Order #"] === 0) return false;
      
      return true;
    }).map(comment => {
      // Clean and normalize data
      return {
        ...comment,
        "Order #": this.cleanOrderNumber(comment["Order #"]),
        "Date Added": this.cleanDate(comment["Date Added"]),
        "Comment": this.cleanText(comment["Comment"]),
        "Employee Names": this.cleanText(comment["Employee Names"])
      };
    });

    // Save cleaned data
    const cleanedPath = path.join(this.cleanedDir, "Employee Comments.xlsx");
    const newWorkbook = XLSX.utils.book_new();
    const newWorksheet = XLSX.utils.json_to_sheet(cleanedData);
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Sheet1");
    XLSX.writeFile(newWorkbook, cleanedPath);
    
    console.log(`✅ Cleaned employee comments: ${cleanedData.length} valid records (removed ${commentsData.length - cleanedData.length} invalid)`);
  }

  // Utility methods for data cleaning
  private safeString(value: any): string {
    if (value === null || value === undefined) return "";
    return String(value);
  }

  private cleanEmail(email: any): string {
    if (!email) return "";
    return String(email).trim().toLowerCase();
  }

  private cleanName(name: any): string {
    if (!name) return "";
    return String(name).trim();
  }

  private cleanPhone(phone: any): string {
    if (!phone) return "";
    return String(phone).trim();
  }

  private cleanText(text: any): string {
    if (!text) return "";
    return String(text).trim();
  }

  private cleanOrderNumber(orderNumber: any): string {
    if (!orderNumber) return "";
    return String(orderNumber).trim();
  }

  private cleanDate(date: any): string {
    if (!date) return "";
    
    // Handle special cases like "0000-00-00 00:00:00"
    if (String(date).includes("0000-00-00")) return "";
    
    return String(date).trim();
  }

  private cleanAmount(amount: any): string {
    if (!amount) return "";
    if (amount === "" || amount === null || amount === undefined) return "";
    return String(amount).trim();
  }

  private parseCSV(csvContent: string): any[] {
    try {
      return parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        quote: '"',
        escape: '"',
        delimiter: ",",
        relax_column_count: true,
        trim: true,
        cast: true,
        skip_records_with_error: true,
      });
    } catch (error) {
      console.error("CSV parsing failed:", error);
      return [];
    }
  }

  private saveCSV(filePath: string, data: any[]): void {
    if (data.length === 0) {
      console.log("⚠️  No data to save");
      return;
    }

    // Convert to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        // Escape commas and quotes
        if (stringValue.includes(",") || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(","))
    ].join("\n");

    fs.writeFileSync(filePath, csvContent, "utf-8");
  }
}

// Main execution
async function main() {
  try {
    const cleaner = new FinalDataCleaner();
    await cleaner.cleanAllData();
  } catch (error) {
    console.error("💥 Data cleaning failed:", error);
    process.exit(1);
  }
}

// Run the cleaning
if (require.main === module) {
  main();
}

export { FinalDataCleaner };
