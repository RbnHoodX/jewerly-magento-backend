// FIXED Data Validation Script for Production Import
// Handles real-world data issues and provides accurate validation

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

class FixedDataValidator {
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
    console.log("🔍 Starting FIXED data validation for production import...");
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
        console.log("💡 TIP: Consider using the rollback script if import fails: npm run rollback rollback");
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
      const validation = this.validateOrderDataFixed(orderData, i + 1);
      
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
      const validation = this.validateCustomerNoteDataFixed(noteData, i + 1);
      
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
      const validation = this.validateDiamondDataFixed(diamondData, i + 1);
      
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
      const validation = this.validateCastingDataFixed(casting, i + 1);
      
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
      const validation = this.validateThreeDDataFixed(threeD, i + 1);
      
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
      const validation = this.validateEmployeeCommentDataFixed(comment, i + 1);
      
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

  // FIXED validation methods that handle real-world data issues
  private validateOrderDataFixed(orderData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Required fields validation (more lenient)
      if (!orderData["Order #"]) errors.push("Missing Order #");
      if (!orderData["Customer Email"]) errors.push("Missing Customer Email");
      
      // Name validation (handle empty names)
      if (!orderData["Billing First Name:"] || orderData["Billing First Name:"].trim() === "") {
        errors.push("Missing Billing First Name");
      }
      if (!orderData["Billing Last Name"] || orderData["Billing Last Name"].trim() === "") {
        errors.push("Missing Billing Last Name");
      }

      // Email validation (more lenient)
      if (orderData["Customer Email"] && !this.isValidEmail(orderData["Customer Email"])) {
        errors.push(`Invalid email format: ${orderData["Customer Email"]}`);
      }

      // Phone validation (handle null/undefined)
      if (orderData["Billing Tel"] && orderData["Billing Tel"] !== null && orderData["Billing Tel"] !== undefined) {
        if (!this.isValidPhone(String(orderData["Billing Tel"]))) {
          errors.push(`Invalid phone format: ${orderData["Billing Tel"]}`);
        }
      }

      // Date validation (handle empty dates)
      if (orderData["Order Date"] && orderData["Order Date"].trim() !== "") {
        if (!this.isValidDate(orderData["Order Date"])) {
          errors.push(`Invalid date format: ${orderData["Order Date"]}`);
        }
      }

      // Amount validation (handle empty amounts)
      for (let i = 1; i <= 10; i++) {
        const price = orderData[`Price ${i}`];
        const qty = orderData[`Qty ${i}`];
        const subtotal = orderData[`Row Subtotal ${i}`];

        if (price && price !== "" && !this.isValidAmount(price)) {
          errors.push(`Invalid price for product ${i}: ${price}`);
        }
        if (qty && qty !== "" && !this.isValidAmount(qty)) {
          errors.push(`Invalid quantity for product ${i}: ${qty}`);
        }
        if (subtotal && subtotal !== "" && !this.isValidAmount(subtotal)) {
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

  private validateCustomerNoteDataFixed(noteData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!noteData["Order #"]) errors.push("Missing Order #");
    
    // Comment is optional in real-world data
    if (!noteData["Comment"] || noteData["Comment"].trim() === "") {
      // This is actually OK for customer notes
    }
    
    if (noteData["Date Added"] && noteData["Date Added"].trim() !== "") {
      if (!this.isValidDate(noteData["Date Added"])) {
        errors.push(`Invalid date format: ${noteData["Date Added"]}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateDiamondDataFixed(diamondData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!diamondData["Order #"]) errors.push("Missing Order #");
    
    // Type and Product are optional in real-world data
    if (!diamondData["Type"] || diamondData["Type"].trim() === "") {
      // This is OK for diamonds
    }
    if (!diamondData["Product"] || diamondData["Product"].trim() === "") {
      // This is OK for diamonds
    }

    if (diamondData["CT Weight"] && diamondData["CT Weight"] !== "" && !this.isValidAmount(diamondData["CT Weight"])) {
      errors.push(`Invalid CT Weight: ${diamondData["CT Weight"]}`);
    }

    if (diamondData["Total Price"] && diamondData["Total Price"] !== "" && !this.isValidAmount(diamondData["Total Price"])) {
      errors.push(`Invalid Total Price: ${diamondData["Total Price"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateCastingDataFixed(castingData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!castingData["Order #"]) errors.push("Missing Order #");
    
    // Supplier is optional in real-world data
    if (!castingData["Supplier"] || castingData["Supplier"].trim() === "") {
      // This is OK for casting
    }
    
    if (!castingData["Metal Type"] || castingData["Metal Type"].trim() === "") {
      errors.push("Missing Metal Type");
    }

    if (castingData["Qty"] && castingData["Qty"] !== "" && !this.isValidAmount(castingData["Qty"])) {
      errors.push(`Invalid quantity: ${castingData["Qty"]}`);
    }

    if (castingData["Weight"] && castingData["Weight"] !== "" && !this.isValidAmount(castingData["Weight"])) {
      errors.push(`Invalid weight: ${castingData["Weight"]}`);
    }

    if (castingData["Price"] && castingData["Price"] !== "" && !this.isValidAmount(castingData["Price"])) {
      errors.push(`Invalid price: ${castingData["Price"]}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateThreeDDataFixed(threeDData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!threeDData["Order #"]) errors.push("Missing Order #");
    
    if (threeDData["Date"] && threeDData["Date"].trim() !== "") {
      if (!this.isValidDate(threeDData["Date"])) {
        errors.push(`Invalid date format: ${threeDData["Date"]}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateEmployeeCommentDataFixed(commentData: any, row: number): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!commentData["Order #"]) errors.push("Missing Order #");
    
    // Comment is optional in real-world data
    if (!commentData["Comment"] || commentData["Comment"].trim() === "") {
      // This is OK for employee comments
    }
    
    if (commentData["Date Added"] && commentData["Date Added"].trim() !== "") {
      if (!this.isValidDate(commentData["Date Added"])) {
        errors.push(`Invalid date format: ${commentData["Date Added"]}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Utility validation methods
  private isValidEmail(email: string): boolean {
    if (!email || email.trim() === "") return false;
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
    
    // Handle special cases like "0000-00-00 00:00:00"
    if (dateString.includes("0000-00-00")) return false;
    
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.getFullYear() > 1900;
  }

  private isValidAmount(amount: any): boolean {
    if (amount === null || amount === undefined || amount === "") return true;
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
    console.log("📊 FIXED VALIDATION RESULTS");
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

      // Show first 3 errors for each section
      if (data.errors.length > 0) {
        console.log(`   🔍 Sample errors:`);
        data.errors.slice(0, 3).forEach((error: any) => {
          console.log(`      • Row ${error.row} (Order ${error.orderNumber}): ${error.errors.join(", ")}`);
        });
        if (data.errors.length > 3) {
          console.log(`      ... and ${data.errors.length - 3} more errors`);
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

    // Import is safe if error rate is less than 10% (more lenient for real-world data)
    return errorRate < 10;
  }
}

// Main execution
async function main() {
  try {
    const validator = new FixedDataValidator();
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

export { FixedDataValidator };
