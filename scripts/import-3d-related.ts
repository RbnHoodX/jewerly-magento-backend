import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

require('dotenv').config();

class ThreeDRelatedImporter {
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

  async importThreeDRelated(): Promise<void> {
    console.log('🎨 Starting 3D Related Import...');
    
    const filePath = path.join(this.migrationDir, "3drelated.csv");
    
    if (!fs.existsSync(filePath)) {
      console.log('❌ 3drelated.csv file not found');
      return;
    }

    // Check existing data
    const { count: existingCount } = await this.supabase
      .from('order_3d_related')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Existing 3D related records: ${existingCount || 0}`);
    
    if (existingCount > 0) {
      console.log('⚠️  3D related data already exists. Skipping import to avoid duplicates.');
      console.log('💡 To re-import, first clear the data: npm run clear-3d-related');
      return;
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');
    const threeDData = this.parseCSV(csvContent);
    
    console.log(`🎨 Found ${threeDData.length} 3D related records to import`);
    
    if (threeDData.length === 0) {
      console.log('✅ No 3D related data to import');
      return;
    }

    // Get all order numbers
    const orderNumbers = [...new Set(threeDData.map((item) => item["Order #"]))];
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

    const threeDInserts: any[] = [];
    let skippedCount = 0;

    for (const threeDItem of threeDData) {
      if (!orderMap.has(threeDItem["Order #"])) {
        skippedCount++;
        continue;
      }

      const threeDInsert = {
        order_id: orderMap.get(threeDItem["Order #"]),
        image_url: threeDItem["File Path"] || "",
        image_name: threeDItem["Design Type"] || "3D Design",
      };

      threeDInserts.push(threeDInsert);
    }

    console.log(`🎨 Prepared ${threeDInserts.length} 3D related records for import`);
    console.log(`⚠️  Skipped ${skippedCount} 3D related records (order not found)`);

    if (threeDInserts.length > 0) {
      // Batch insert 3D related
      const batches = this.chunkArray(threeDInserts, this.BATCH_SIZE);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`🎨 Processing 3D related batch ${i + 1}/${batches.length}`);
        
        const { error } = await this.supabase
          .from("order_3d_related")
          .insert(batch);
        
        if (error) {
          console.error(`❌ Error inserting batch ${i + 1}:`, error);
          throw error;
        }
      }
      
      console.log('✅ 3D Related import completed successfully!');
    } else {
      console.log('⚠️  No valid 3D related records to insert');
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
const importer = new ThreeDRelatedImporter();
importer.importThreeDRelated().catch(console.error);
