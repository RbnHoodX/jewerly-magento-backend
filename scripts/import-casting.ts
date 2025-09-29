import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

require('dotenv').config();

class CastingImporter {
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

  async importCasting(): Promise<void> {
    console.log('🏭 Starting Casting Import...');
    
    const filePath = path.join(this.migrationDir, "casting.csv");
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ casting.csv file not found');
      return;
    }

    // Check existing data
    const { count: existingCount } = await this.supabase
      .from('order_casting')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Existing casting records: ${existingCount || 0}`);
    
    if (existingCount > 0) {
      console.log('⚠️  Casting data already exists. Skipping import to avoid duplicates.');
      console.log('💡 To re-import, first clear the data: npm run clear-casting');
      return;
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const castingData = this.parseCSV(csvContent);
    
    console.log(`🏭 Found ${castingData.length} casting records to import`);
    
    if (castingData.length === 0) {
      console.log('✅ No casting data to import');
      return;
    }

    // Get all order numbers
    const orderNumbers = [...new Set(castingData.map((casting) => casting["Order #"]))];
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

    const castingInserts: any[] = [];
    let skippedCount = 0;

    for (const castingDataItem of castingData) {
      if (!orderMap.has(castingDataItem["Order #"])) {
        skippedCount++;
        continue;
      }

      const castingInsert = {
        order_id: orderMap.get(castingDataItem["Order #"]),
        supplier: "System Import",
        metal_type: castingDataItem["Material"] || "Gold",
        quantity: "1",
        weight: parseFloat(castingDataItem["Weight"]) || 0,
        weight_unit: "g",
        price: 0,
      };

      castingInserts.push(castingInsert);
    }

    console.log(`🏭 Prepared ${castingInserts.length} casting records for import`);
    console.log(`⚠️  Skipped ${skippedCount} casting records (order not found)`);

    if (castingInserts.length > 0) {
      // Batch insert casting
      const batches = this.chunkArray(castingInserts, this.BATCH_SIZE);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🏭 Processing casting batch ${i + 1}/${batches.length}`);
        
        const { error } = await this.supabase
          .from("order_casting")
          .insert(batch);
        
        if (error) {
          console.error(`❌ Error inserting batch ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('✅ Casting import completed successfully!');
    } else {
      console.log('⚠️  No valid casting records to insert');
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
const importer = new CastingImporter();
importer.importCasting().catch(console.error);
