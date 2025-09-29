import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

require('dotenv').config();

class CustomerNotesImporter {
  private supabase: any;
  private migrationDir: string;
  private BATCH_SIZE = 500;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.migrationDir = path.join(__dirname, "../migration/cleaned");
  }

  async importCustomerNotes(): Promise<void> {
    console.log('📝 Starting Customer Notes Import...');
    
    const filePath = path.join(this.migrationDir, "Customer Notes.csv");
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Customer Notes.csv file not found');
      return;
    }

    // Check existing data
    const { count: existingCount } = await this.supabase
      .from('order_customer_notes')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Existing customer notes: ${existingCount || 0}`);
    
    if (existingCount > 0) {
      console.log('⚠️  Customer notes already exist. Skipping import to avoid duplicates.');
      console.log('💡 To re-import, first clear the data: npm run clear-customer-notes');
      return;
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const notesData = this.parseCSV(csvContent);
    
    console.log(`📝 Found ${notesData.length} customer notes to import`);
    
    if (notesData.length === 0) {
      console.log('✅ No customer notes to import');
      return;
    }

    // Get all order numbers
    const orderNumbers = [...new Set(notesData.map((note) => note["Order #"]))];
    console.log(`📦 Found ${orderNumbers.length} unique orders`);
    
    // Fetch existing orders in batches
    const orderMap = new Map();
    const batchSize = 1000;
    const batches = this.chunkArray(orderNumbers, batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 Fetching orders batch ${i + 1}/${batches.length} (${batch.length} orders)`);
      
      const { data: orders, error: orderError } = await this.supabase
        .from("orders")
        .select("id, order_id")
        .in("order_id", batch);
      
      if (orderError) {
        console.error('❌ Error fetching orders:', orderError);
        throw orderError;
      }
      
      orders?.forEach((order) => {
        orderMap.set(order.order_id, order.id);
      });
    }

    console.log(`📦 Found ${orderMap.size} matching orders in database`);

    const noteInserts: any[] = [];
    let skippedCount = 0;

    for (const noteData of notesData) {
      if (!orderMap.has(noteData["Order #"])) {
        skippedCount++;
        continue;
      }

      const noteInsert = {
        order_id: orderMap.get(noteData["Order #"]),
        content: noteData["Comment"] || "No comment provided",
        is_important: false,
        created_by: null,
      };

      noteInserts.push(noteInsert);
    }

    console.log(`📝 Prepared ${noteInserts.length} customer notes for import`);
    console.log(`⚠️  Skipped ${skippedCount} notes (order not found)`);

    if (noteInserts.length > 0) {
      // Batch insert customer notes
      const batches = this.chunkArray(noteInserts, this.BATCH_SIZE);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`📝 Processing customer notes batch ${i + 1}/${batches.length}`);
        
        const { error } = await this.supabase
          .from("order_customer_notes")
          .insert(batch);
        
        if (error) {
          console.error(`❌ Error inserting batch ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('✅ Customer notes import completed successfully!');
    } else {
      console.log('⚠️  No valid customer notes to insert');
    }
  }

  private parseCSV(content: string): any[] {
    return parse(content, { columns: true });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Run the import
const importer = new CustomerNotesImporter();
importer.importCustomerNotes().catch(console.error);
