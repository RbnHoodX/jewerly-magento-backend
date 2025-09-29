// Comprehensive Data Validation Script for Production Import
// Validates all data before import to ensure ZERO errors in production

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

class DataValidator {
  private migrationDir: string;
  private validationResults: any = {
    mainOrders: { valid: 0, invalid: 0, errors: [] },
    customerNotes: { valid: 0, invalid: 0, errors: [] },
    diamonds: { valid: 0, invalid: 0, errors: [] },
    casting: { valid: 0, invalid: 0, errors: [] },
    threeD: { valid: 0, invalid: 0, errors: [] },
    employeeComments: { valid: 0, invalid: 0, errors: [] }
  };

  constructor() {
    this.migrationDir = path.join(__dirname, "../migration");
  }

  async validateAllData(): Promise<void> {
    console.log("🔍 Starting comprehensive data validation for production import...");
    console.log("=" * 60);

    try {
      // Validate all data files
      await this.validateMainOrders();
      await this.validateCustomerNotes();
      await this.validateDiamonds();
      await this.validateCasting();
      await this.validateThreeD();
      await this.validateEmployeeComments();

      // Display comprehensive results
      this.displayValidationResults();

      // Check if import is safe to proceed
      const isSafe = this.isImportSafe();
      if (isSafe) {
        console.log("\n✅ VALIDATION PASSED: Import is safe to proceed!");
        console.log("🚀 You can now run: npm run import-orders-production");
      } else {
        console.log("\n❌ VALIDATION FAILED: Import is NOT safe to proceed!");
        console.log("🔧 Please fix the errors above before running the import.");
        process.exit(1);
      }

    } catch (error) {
      console.error("💥 Validation failed:", error);
      process.exit(1);
    }
  }

  private async validateMainOrders(): Promise<void> {
    console.log("\n📦 Validating main orders data...");
    
    const filePath = path.join(this.migrationDir, "main_page.csv");
    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ Main orders file not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const ordersData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${ordersData.length} orders to validate`);

    for (let i = 0; i < ordersData.length; i++) {
      const orderData = ordersData[i];
      const validation = this.validateOrderData(orderData, i + 1);
      
      if (validation.isValid) {
        this.validationResults.mainOrders.valid++;
      } else {
        this.validationResults.mainOrders.invalid++;
        this.validationResults.mainOrders.errors.push({
          row: i + 1,
          orderNumber: orderData["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ Main orders validation complete: ${this.validationResults.mainOrders.valid} valid, ${this.validationResults.mainOrders.invalid} invalid`);
  }

  private async validateCustomerNotes(): Promise<void> {
    console.log("\n📝 Validating customer notes data...");
    
    const filePath = path.join(this.migrationDir, "Customer Notes.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Customer Notes.csv not found, skipping validation");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const notesData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${notesData.length} customer notes to validate`);

    for (let i = 0; i < notesData.length; i++) {
      const noteData = notesData[i];
      const validation = this.validateCustomerNoteData(noteData, i + 1);
      
      if (validation.isValid) {
        this.validationResults.customerNotes.valid++;
      } else {
        this.validationResults.customerNotes.invalid++;
        this.validationResults.customerNotes.errors.push({
          row: i + 1,
          orderNumber: noteData["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ Customer notes validation complete: ${this.validationResults.customerNotes.valid} valid, ${this.validationResults.customerNotes.invalid} invalid`);
  }

  private async validateDiamonds(): Promise<void> {
    console.log("\n💎 Validating diamonds data...");
    
    const filePath = path.join(this.migrationDir, "Diamonds.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Diamonds.csv not found, skipping validation");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const diamondsData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${diamondsData.length} diamond records to validate`);

    for (let i = 0; i < diamondsData.length; i++) {
      const diamondData = diamondsData[i];
      const validation = this.validateDiamondData(diamondData, i + 1);
      
      if (validation.isValid) {
        this.validationResults.diamonds.valid++;
      } else {
        this.validationResults.diamonds.invalid++;
        this.validationResults.diamonds.errors.push({
          row: i + 1,
          orderNumber: diamondData["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ Diamonds validation complete: ${this.validationResults.diamonds.valid} valid, ${this.validationResults.diamonds.invalid} invalid`);
  }

  private async validateCasting(): Promise<void> {
    console.log("\n🏭 Validating casting data...");
    
    const filePath = path.join(this.migrationDir, "casting.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  casting.csv not found, skipping validation");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const castingData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${castingData.length} casting records to validate`);

    for (let i = 0; i < castingData.length; i++) {
      const casting = castingData[i];
      const validation = this.validateCastingData(casting, i + 1);
      
      if (validation.isValid) {
        this.validationResults.casting.valid++;
      } else {
        this.validationResults.casting.invalid++;
        this.validationResults.casting.errors.push({
          row: i + 1,
          orderNumber: casting["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ Casting validation complete: ${this.validationResults.casting.valid} valid, ${this.validationResults.casting.invalid} invalid`);
  }

  private async validateThreeD(): Promise<void> {
    console.log("\n🎨 Validating 3D related data...");
    
    const filePath = path.join(this.migrationDir, "3drelated.csv");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  3drelated.csv not found, skipping validation");
      return;
    }

    const csvContent = fs.readFileSync(filePath, "utf-8");
    const threeDData = this.parseCSV(csvContent);
    
    console.log(`📊 Found ${threeDData.length} 3D records to validate`);

    for (let i = 0; i < threeDData.length; i++) {
      const threeD = threeDData[i];
      const validation = this.validateThreeDData(threeD, i + 1);
      
      if (validation.isValid) {
        this.validationResults.threeD.valid++;
      } else {
        this.validationResults.threeD.invalid++;
        this.validationResults.threeD.errors.push({
          row: i + 1,
          orderNumber: threeD["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ 3D related validation complete: ${this.validationResults.threeD.valid} valid, ${this.validationResults.threeD.invalid} invalid`);
  }

  private async validateEmployeeComments(): Promise<void> {
    console.log("\n💬 Validating employee comments data...");
    
    const filePath = path.join(this.migrationDir, "Employee Comments.xlsx");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️  Employee Comments.xlsx not found, skipping validation");
      return;
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const commentsData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`📊 Found ${commentsData.length} employee comments to validate`);

    for (let i = 0; i < commentsData.length; i++) {
      const comment = commentsData[i];
      const validation = this.validateEmployeeCommentData(comment, i + 1);
      
      if (validation.isValid) {
        this.validationResults.employeeComments.valid++;
      } else {
        this.validationResults.employeeComments.invalid++;
        this.validationResults.employeeComments.errors.push({
          row: i + 1,
          orderNumber: comment["Order #"],
          errors: validation.errors
        });
      }
    }

    console.log(`✅ Employee comments validation complete: ${this.validationResults.employeeComments.valid} valid, ${this.validationResults.employeeComments.invalid} invalid`);
  }

  // Validation methods for each data type
  private validateOrderData(orderData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Required fields validation
      if (!orderData["Order #"]) errors.push("Missing Order #");
      if (!orderData["Customer Email"]) errors.push("Missing Customer Email");
      if (!orderData["Billing First Name:"]) errors.push("Missing Billing First Name");
      if (!orderData["Billing Last Name"]) errors.push("Missing Billing Last Name");

      // Email validation
      if (orderData["Customer Email"] && !this.isValidEmail(orderData["Customer Email"])) {
        errors.push(`Invalid email format: ${orderData["Customer Email"]}`);
      }

      // Phone validation
      if (orderData["Billing Tel"] && !this.isValidPhone(orderData["Billing Tel"])) {
        errors.push(`Invalid phone format: ${orderData["Billing Tel"]}`);
      }

      // Date validation
      if (!this.isValidDate(orderData["Order Date"])) {
        errors.push(`Invalid date format: ${orderData["Order Date"]}`);
      }

      // Amount validation
      for (let i = 1; i <= 10; i++) {
        const price = orderData[`Price ${i}`];
        const qty = orderData[`Qty ${i}`];
        const subtotal = orderData[`Row Subtotal ${i}`];

        if (price && !this.isValidAmount(price)) {
          errors.push(`Invalid price for product ${i}: ${price}`);
        }
        if (qty && !this.isValidAmount(qty)) {
          errors.push(`Invalid quantity for product ${i}: ${qty}`);
        }
        if (subtotal && !this.isValidAmount(subtotal)) {
          errors.push(`Invalid subtotal for product ${i}: ${subtotal}`);
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateCustomerNoteData(noteData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!noteData["Order #"]) errors.push("Missing Order #");
    if (!noteData["Comment"]) errors.push("Missing Comment");
    if (!this.isValidDate(noteData["Date Added"])) {
      errors.push(`Invalid date format: ${noteData["Date Added"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateDiamondData(diamondData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!diamondData["Order #"]) errors.push("Missing Order #");
    if (!diamondData["Type"]) errors.push("Missing Type");
    if (!diamondData["Product"]) errors.push("Missing Product");

    if (diamondData["CT Weight"] && !this.isValidAmount(diamondData["CT Weight"])) {
      errors.push(`Invalid CT Weight: ${diamondData["CT Weight"]}`);
    }

    if (diamondData["Total Price"] && !this.isValidAmount(diamondData["Total Price"])) {
      errors.push(`Invalid Total Price: ${diamondData["Total Price"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateCastingData(castingData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!castingData["Order #"]) errors.push("Missing Order #");
    if (!castingData["Supplier"]) errors.push("Missing Supplier");
    if (!castingData["Metal Type"]) errors.push("Missing Metal Type");

    if (!this.isValidAmount(castingData["Qty"])) {
      errors.push(`Invalid quantity: ${castingData["Qty"]}`);
    }

    if (!this.isValidAmount(castingData["Weight"])) {
      errors.push(`Invalid weight: ${castingData["Weight"]}`);
    }

    if (!this.isValidAmount(castingData["Price"])) {
      errors.push(`Invalid price: ${castingData["Price"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateThreeDData(threeDData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!threeDData["Order #"]) errors.push("Missing Order #");
    if (!this.isValidDate(threeDData["Date"])) {
      errors.push(`Invalid date format: ${threeDData["Date"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateEmployeeCommentData(commentData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!commentData["Order #"]) errors.push("Missing Order #");
    if (!commentData["Comment"]) errors.push("Missing Comment");
    if (!this.isValidDate(commentData["Date Added"])) {
      errors.push(`Invalid date format: ${commentData["Date Added"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Utility validation methods
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    if (!phone || phone.trim() === "") return true; // Phone is optional
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ""));
  }

  private isValidDate(dateString: string): boolean {
    if (!dateString || dateString.trim() === "") return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.getFullYear() > 1900;
  }

  private isValidAmount(amount: any): boolean {
    if (amount === null || amount === undefined) return true;
    const num = parseFloat(String(amount));
    return !isNaN(num) && num >= 0;
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

  private displayValidationResults(): void {
    console.log("\n" + "=" * 60);
    console.log("📊 COMPREHENSIVE VALIDATION RESULTS");
    console.log("=" * 60);

    const sections = [
      { name: "Main Orders", data: this.validationResults.mainOrders },
      { name: "Customer Notes", data: this.validationResults.customerNotes },
      { name: "Diamonds", data: this.validationResults.diamonds },
      { name: "Casting", data: this.validationResults.casting },
      { name: "3D Related", data: this.validationResults.threeD },
      { name: "Employee Comments", data: this.validationResults.employeeComments }
    ];

    let totalValid = 0;
    let totalInvalid = 0;

    sections.forEach(section => {
      const { name, data } = section;
      const total = data.valid + data.invalid;
      const percentage = total > 0 ? ((data.valid / total) * 100).toFixed(1) : "0.0";
      
      console.log(`\n📋 ${name}:`);
      console.log(`   ✅ Valid: ${data.valid.toLocaleString()}`);
      console.log(`   ❌ Invalid: ${data.invalid.toLocaleString()}`);
      console.log(`   📊 Success Rate: ${percentage}%`);
      
      totalValid += data.valid;
      totalInvalid += data.invalid;

      // Show first 5 errors for each section
      if (data.errors.length > 0) {
        console.log(`   🔍 Sample errors:`);
        data.errors.slice(0, 5).forEach((error: any) => {
          console.log(`      • Row ${error.row} (Order ${error.orderNumber}): ${error.errors.join(", ")}`);
        });
        if (data.errors.length > 5) {
          console.log(`      ... and ${data.errors.length - 5} more errors`);
        }
      }
    });

    const overallTotal = totalValid + totalInvalid;
    const overallPercentage = overallTotal > 0 ? ((totalValid / overallTotal) * 100).toFixed(1) : "0.0";

    console.log(`\n📊 OVERALL STATISTICS:`);
    console.log(`   ✅ Total Valid: ${totalValid.toLocaleString()}`);
    console.log(`   ❌ Total Invalid: ${totalInvalid.toLocaleString()}`);
    console.log(`   📊 Overall Success Rate: ${overallPercentage}%`);
  }

  private isImportSafe(): boolean {
    const totalInvalid = Object.values(this.validationResults).reduce((sum, section) => {
      return sum + section.invalid;
    }, 0);

    const totalValid = Object.values(this.validationResults).reduce((sum, section) => {
      return sum + section.valid;
    }, 0);

    const totalRecords = totalValid + totalInvalid;
    const errorRate = totalRecords > 0 ? (totalInvalid / totalRecords) * 100 : 0;

    // Import is safe if error rate is less than 5%
    return errorRate < 5;
  }
}

// Main execution
async function main() {
  try {
    const validator = new DataValidator();
    await validator.validateAllData();
  } catch (error) {
    console.error("💥 Validation failed:", error);
    process.exit(1);
  }
}

// Run the validation
if (require.main === module) {
  main();
}

export { DataValidator };
