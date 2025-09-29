import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

require('dotenv').config();

class DiamondsImporter {
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

  async importDiamonds(): Promise<void> {
    console.log('💎 Starting Diamonds Import...');
    
    const filePath = path.join(this.migrationDir, "Diamonds.csv");
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ Diamonds.csv file not found');
      return;
    }

    // Check existing data
    const { count: existingCount } = await this.supabase
      .from('diamond_deductions')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Existing diamonds: ${existingCount || 0}`);
    
    if (existingCount > 0) {
      console.log('⚠️  Diamonds already exist. Skipping import to avoid duplicates.');
      console.log('💡 To re-import, first clear the data: npm run clear-diamonds');
      return;
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const diamondsData = this.parseCSV(csvContent);
    
    console.log(`💎 Found ${diamondsData.length} diamonds to import`);
    
    if (diamondsData.length === 0) {
      console.log('✅ No diamonds to import');
      return;
    }

    // Get all order numbers
    const orderNumbers = [...new Set(diamondsData.map((diamond) => diamond["Order #"]))];
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

    const diamondInserts: any[] = [];
    let skippedCount = 0;

    for (const diamondData of diamondsData) {
      if (!orderMap.has(diamondData["Order #"])) {
        skippedCount++;
        continue;
      }

      const diamondInsert = {
        order_id: orderMap.get(diamondData["Order #"]),
        type: "center",
        product_sku: `DIAMOND-${diamondData["Order #"]}`,
        parcel_id: `PARCEL-${diamondData["Order #"]}`,
        ct_weight: parseFloat(diamondData["Carat Weight"]) || 0,
        stones: diamondData["Shape"] || "Round",
        price_per_ct: parseFloat(diamondData["Price"]) || 0,
        total_price: parseFloat(diamondData["Price"]) || 0,
      };

      diamondInserts.push(diamondInsert);
    }

    console.log(`💎 Prepared ${diamondInserts.length} diamonds for import`);
    console.log(`⚠️  Skipped ${skippedCount} diamonds (order not found)`);

    if (diamondInserts.length > 0) {
      // Batch insert diamonds
      const batches = this.chunkArray(diamondInserts, this.BATCH_SIZE);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`💎 Processing diamonds batch ${i + 1}/${batches.length}`);
        
        const { error } = await this.supabase
          .from("diamond_deductions")
          .insert(batch);
        
        if (error) {
          console.error(`❌ Error inserting batch ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('✅ Diamonds import completed successfully!');
    } else {
      console.log('⚠️  No valid diamonds to insert');
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
const importer = new DiamondsImporter();
importer.importDiamonds().catch(console.error);
