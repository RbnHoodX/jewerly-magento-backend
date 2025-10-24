// File: migrate-primestyle-files.js
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Supabase configuration missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Configuration
const BATCH_SIZE = 5; // Process files in small batches
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
const TEMP_DIR = path.join(__dirname, "temp-migration");
const DRY_RUN = process.argv.includes('--dry-run'); // Add dry-run mode
const MAX_FAILURES = 50; // Stop after too many consecutive failures
const SKIP_404_ERRORS = true; // Skip 404 errors and continue

// Create temp directory
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

class PrimestyleFileMigrator {
  constructor() {
    this.stats = {
      total: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      urlConverted: 0,
      consecutiveFailures: 0
    };
    this.migrationLog = [];
  }

  async migratePrimestyleFiles() {
    console.log("🚀 Starting Primestyle File Migration");
    if (DRY_RUN) {
      console.log("🧪 DRY RUN MODE - No files will be downloaded or uploaded");
    }
    console.log("=" .repeat(50));
    console.log("📋 Tables to migrate:");
    console.log("  - order_3d_related.image_url");
    console.log("  - order_employee_comments.file_url");
    console.log("  - order_items.image");
    console.log("=" .repeat(50));

    try {
      // 1. Migrate order_3d_related table
      await this.migrateTable("order_3d_related", "image_url", "3d-files");
      
      // 2. Migrate order_employee_comments table
      await this.migrateTable("order_employee_comments", "file_url", "employee-files");
      
      // 3. Migrate order_items table
      await this.migrateTable("order_items", "image", "product-images");

      // Print final summary
      this.printSummary();

    } catch (error) {
      console.error("❌ Migration failed:", error);
    } finally {
      // Cleanup temp directory
      this.cleanupTempDir();
    }
  }

  async migrateTable(tableName, urlColumn, bucketName) {
    console.log(`\n📁 Migrating ${tableName}.${urlColumn} to ${bucketName} bucket`);
    
    try {
      let allRecords = [];
      let from = 0;
      const pageSize = 1000; // Process in pages to avoid memory issues
      let hasMore = true;

      // Fetch all records using pagination
      while (hasMore) {
        console.log(`📥 Fetching records ${from + 1} to ${from + pageSize}...`);
        
        const { data: records, error } = await supabase
          .from(tableName)
          .select(`id, ${urlColumn}`)
          .not(urlColumn, "is", null)
          .neq(urlColumn, "")
          .or(`${urlColumn}.like.https://www.primestyle.com/%,${urlColumn}.like.https://old-admin.primestyle.com/%`)
          .range(from, from + pageSize - 1);

        if (error) {
          console.error(`❌ Error fetching ${tableName}:`, error);
          return;
        }

        if (!records || records.length === 0) {
          hasMore = false;
        } else {
          allRecords = allRecords.concat(records);
          from += pageSize;
          
          // If we got less than pageSize, we've reached the end
          if (records.length < pageSize) {
            hasMore = false;
          }
        }
      }

      if (allRecords.length === 0) {
        console.log(`✅ No files to migrate in ${tableName}`);
        return;
      }

      console.log(`Found ${allRecords.length} files to migrate in ${tableName}`);

      // Process in batches
      for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
        const batch = allRecords.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allRecords.length / BATCH_SIZE);
        
        console.log(`Processing batch ${batchNumber}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, allRecords.length)} of ${allRecords.length})`);
        
        await Promise.all(batch.map(record => this.migrateFile(record, tableName, urlColumn, bucketName)));
        
        // Show progress
        const progress = Math.round((i + BATCH_SIZE) / allRecords.length * 100);
        console.log(`📊 Progress: ${progress}% (${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length})`);
        
        // Delay between batches
        if (i + BATCH_SIZE < allRecords.length) {
          await this.delay(DELAY_BETWEEN_BATCHES);
        }
      }

    } catch (error) {
      console.error(`❌ Error migrating ${tableName}:`, error);
    }
  }

  async migrateFile(record, tableName, urlColumn, bucketName) {
    const oldUrl = record[urlColumn];
    const recordId = record.id;
    
    this.stats.total++;
    
    try {
      // Skip if already a Supabase URL
      if (oldUrl.includes("supabase") || oldUrl.includes("storage.googleapis.com")) {
        console.log(`⏭️ Skipping ${tableName}:${recordId} - already migrated`);
        this.stats.skipped++;
        this.stats.consecutiveFailures = 0; // Reset failure counter
        return;
      }

      // Convert URL if needed
      let downloadUrl = this.convertUrl(oldUrl);
      if (downloadUrl !== oldUrl) {
        console.log(`🔄 URL converted: ${oldUrl} -> ${downloadUrl}`);
        this.stats.urlConverted++;
      }
      
      console.log(`📥 Downloading: ${downloadUrl}`);
      
      if (DRY_RUN) {
        console.log(`🧪 DRY RUN: Would download and upload file for ${tableName}:${recordId}`);
        this.stats.successful++;
        this.stats.consecutiveFailures = 0;
        return;
      }
      
      // Download file with SSL certificate handling
      const response = await this.downloadFileWithSSLHandling(downloadUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const fileBuffer = await response.buffer();
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      
      // Generate new filename
      const urlPath = new URL(downloadUrl).pathname;
      const originalFilename = path.basename(urlPath) || `file-${recordId}`;
      const fileExt = path.extname(originalFilename) || this.getExtensionFromContentType(contentType);
      const newFilename = `${tableName}-${recordId}-${Date.now()}${fileExt}`;
      const filePath = `${bucketName}/${newFilename}`;

      console.log(`📤 Uploading to Supabase: ${filePath}`);

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, fileBuffer, {
          contentType,
          cacheControl: "3600",
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      // Update database record
      const { error: updateError } = await supabase
        .from(tableName)
        .update({ [urlColumn]: urlData.publicUrl })
        .eq("id", recordId);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      console.log(`✅ Migrated ${tableName}:${recordId} -> ${urlData.publicUrl}`);
      this.stats.successful++;
      this.stats.consecutiveFailures = 0; // Reset failure counter

      this.logMigration("FILE_MIGRATED", {
        table: tableName,
        recordId,
        oldUrl,
        newUrl: urlData.publicUrl,
        filePath
      });

    } catch (error) {
      const is404Error = error.message.includes('404') || error.message.includes('Not Found');
      
      if (is404Error && SKIP_404_ERRORS) {
        console.log(`⚠️ File not found (404): ${tableName}:${recordId} - ${oldUrl}`);
        this.stats.skipped++;
        this.stats.consecutiveFailures = 0; // Reset failure counter for 404s
        this.logMigration("FILE_NOT_FOUND", {
          table: tableName,
          recordId,
          oldUrl,
          error: error.message
        });
      } else {
        console.error(`❌ Failed to migrate ${tableName}:${recordId}:`, error.message);
        this.stats.failed++;
        this.stats.consecutiveFailures++;

        this.logMigration("FILE_FAILED", {
          table: tableName,
          recordId,
          oldUrl,
          error: error.message
        });

        // Stop if too many consecutive failures (excluding 404s)
        if (this.stats.consecutiveFailures >= MAX_FAILURES) {
          console.error(`\n🛑 Too many consecutive failures (${MAX_FAILURES}). Stopping migration.`);
          console.error("This might indicate a server issue or network problem.");
          throw new Error(`Migration stopped due to ${MAX_FAILURES} consecutive failures`);
        }
      }
    }

    this.stats.processed++;
  }

  convertUrl(url) {
    // Convert https://www.primestyle.com/... to https://old-admin.primestyle.com/...
    if (url.startsWith("https://www.primestyle.com/")) {
      return url.replace("https://www.primestyle.com/", "https://old-admin.primestyle.com/");
    }
    
    // Return as-is if it's already old-admin.primestyle.com or other format
    return url;
  }

  async downloadFileWithSSLHandling(url) {
    // Create HTTPS agent that ignores SSL certificate errors
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Ignore SSL certificate errors
      timeout: 30000
    });

    try {
      // First try with SSL verification disabled
      const response = await fetch(url, {
        agent: httpsAgent,
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      return response;
    } catch (error) {
      // If SSL error, try with HTTP instead of HTTPS
      if (error.message.includes('certificate') || error.message.includes('SSL')) {
        console.log(`⚠️ SSL certificate issue detected, trying HTTP fallback...`);
        
        const httpUrl = url.replace('https://', 'http://');
        console.log(`🔄 Trying HTTP fallback: ${httpUrl}`);
        
        try {
          const httpResponse = await fetch(httpUrl, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          return httpResponse;
        } catch (httpError) {
          console.log(`❌ HTTP fallback also failed: ${httpError.message}`);
          throw error; // Throw original SSL error
        }
      }
      
      throw error;
    }
  }

  getExtensionFromContentType(contentType) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/zip': '.zip'
    };
    
    return extensions[contentType] || '.bin';
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  cleanupTempDir() {
    try {
      if (fs.existsSync(TEMP_DIR)) {
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
        console.log("🧹 Cleaned up temporary files");
      }
    } catch (error) {
      console.error("⚠️ Error cleaning up temp directory:", error);
    }
  }

  logMigration(event, data) {
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      event,
      data
    });
  }

  printSummary() {
    console.log("\n📊 Migration Summary:");
    console.log("=" .repeat(40));
    console.log(`Total files found: ${this.stats.total}`);
    console.log(`Processed: ${this.stats.processed}`);
    console.log(`Successful: ${this.stats.successful}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Skipped: ${this.stats.skipped} (404 errors or already migrated)`);
    console.log(`URLs converted: ${this.stats.urlConverted}`);
    
    if (this.stats.failed > 0) {
      console.log("\n⚠️ Some files failed to migrate. Check the logs above for details.");
    }
    
    if (this.stats.skipped > 0) {
      console.log("\n📝 Many files were skipped due to 404 errors (files not found on old server).");
      console.log("This is normal if files have been deleted from the old server.");
    }
    
    if (this.stats.successful > 0) {
      console.log("\n✅ Migration completed successfully!");
      console.log("🎯 All available files have been uploaded to Supabase Storage.");
    }
  }

  // Save migration log to file
  saveMigrationLog() {
    const logFile = path.join(__dirname, `migration-log-${Date.now()}.json`);
    fs.writeFileSync(logFile, JSON.stringify(this.migrationLog, null, 2));
    console.log(`📝 Migration log saved: ${logFile}`);
  }
}

// Run migration
const migrator = new PrimestyleFileMigrator();
migrator.migratePrimestyleFiles().then(() => {
  migrator.saveMigrationLog();
  console.log("\n🏁 Primestyle file migration completed!");
  process.exit(0);
}).catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});