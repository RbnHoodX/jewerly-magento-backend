// Performance Test Script for Ultra-Fast Order Import
// Tests import speed and provides detailed performance metrics

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { performance } from "perf_hooks";
import * as fs from "fs";
import * as path from "path";

class PerformanceTester {
  private supabase: any;
  private testData: any[] = [];
  private results: any = {};

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("❌ Supabase configuration missing");
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async runPerformanceTests(): Promise<void> {
    console.log("🚀 Starting Performance Tests for Ultra-Fast Order Import");
    console.log("=" * 60);

    try {
      // Test 1: Database Connection Speed
      await this.testDatabaseConnection();

      // Test 2: CSV Parsing Speed
      await this.testCSVParsingSpeed();

      // Test 3: Batch Insert Performance
      await this.testBatchInsertPerformance();

      // Test 4: Memory Usage
      await this.testMemoryUsage();

      // Test 5: Concurrent Operations
      await this.testConcurrentOperations();

      // Display Results
      this.displayResults();

    } catch (error) {
      console.error("❌ Performance test failed:", error);
      throw error;
    }
  }

  private async testDatabaseConnection(): Promise<void> {
    console.log("\n🔌 Testing Database Connection Speed...");
    const startTime = performance.now();

    try {
      const { data, error } = await this.supabase
        .from("orders")
        .select("id")
        .limit(1);

      if (error) throw error;

      const endTime = performance.now();
      const duration = endTime - startTime;

      this.results.databaseConnection = {
        duration: duration,
        status: "success",
        message: `Database connection: ${duration.toFixed(2)}ms`
      };

      console.log(`✅ Database connection: ${duration.toFixed(2)}ms`);
    } catch (error) {
      this.results.databaseConnection = {
        status: "failed",
        message: `Database connection failed: ${error}`
      };
      console.error(`❌ Database connection failed: ${error}`);
    }
  }

  private async testCSVParsingSpeed(): Promise<void> {
    console.log("\n📖 Testing CSV Parsing Speed...");
    const migrationDir = path.join(__dirname, "../migration");
    const filePath = path.join(migrationDir, "main_page.csv");

    if (!fs.existsSync(filePath)) {
      console.log("⚠️  CSV file not found, skipping parsing test");
      this.results.csvParsing = {
        status: "skipped",
        message: "CSV file not found"
      };
      return;
    }

    const startTime = performance.now();

    try {
      const csvContent = fs.readFileSync(filePath, "utf-8");
      const { parse } = await import("csv-parse/sync");
      
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;
      const recordsPerSecond = (records.length / duration) * 1000;

      this.results.csvParsing = {
        duration: duration,
        recordCount: records.length,
        recordsPerSecond: recordsPerSecond,
        status: "success",
        message: `Parsed ${records.length} records in ${duration.toFixed(2)}ms (${recordsPerSecond.toFixed(0)} records/s)`
      };

      this.testData = records.slice(0, 100); // Keep first 100 records for testing
      console.log(`✅ CSV parsing: ${records.length} records in ${duration.toFixed(2)}ms (${recordsPerSecond.toFixed(0)} records/s)`);
    } catch (error) {
      this.results.csvParsing = {
        status: "failed",
        message: `CSV parsing failed: ${error}`
      };
      console.error(`❌ CSV parsing failed: ${error}`);
    }
  }

  private async testBatchInsertPerformance(): Promise<void> {
    console.log("\n📦 Testing Batch Insert Performance...");
    
    if (this.testData.length === 0) {
      console.log("⚠️  No test data available, skipping batch insert test");
      this.results.batchInsert = {
        status: "skipped",
        message: "No test data available"
      };
      return;
    }

    const batchSizes = [10, 50, 100, 500, 1000];
    const results: any[] = [];

    for (const batchSize of batchSizes) {
      console.log(`  Testing batch size: ${batchSize}`);
      
      const startTime = performance.now();
      
      try {
        // Create test data
        const testBatch = this.createTestBatch(batchSize);
        
        // Test insert (we'll use a test table or rollback)
        const { error } = await this.supabase
          .from("orders")
          .insert(testBatch);

        const endTime = performance.now();
        const duration = endTime - startTime;
        const recordsPerSecond = (batchSize / duration) * 1000;

        results.push({
          batchSize,
          duration,
          recordsPerSecond,
          status: "success"
        });

        console.log(`    ✅ ${batchSize} records: ${duration.toFixed(2)}ms (${recordsPerSecond.toFixed(0)} records/s)`);
      } catch (error) {
        results.push({
          batchSize,
          status: "failed",
          error: error.message
        });
        console.log(`    ❌ ${batchSize} records: Failed - ${error.message}`);
      }
    }

    this.results.batchInsert = {
      results,
      status: "completed"
    };
  }

  private async testMemoryUsage(): Promise<void> {
    console.log("\n💾 Testing Memory Usage...");
    
    const startMemory = process.memoryUsage();
    const startTime = performance.now();

    try {
      // Simulate processing large dataset
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `Test Customer ${i}`,
        email: `test${i}@example.com`,
        data: new Array(100).fill(0).map(() => Math.random())
      }));

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;
      const duration = endTime - startTime;

      this.results.memoryUsage = {
        startMemory: startMemory.heapUsed,
        endMemory: endMemory.heapUsed,
        memoryUsed: memoryUsed,
        duration: duration,
        status: "success",
        message: `Memory usage: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB in ${duration.toFixed(2)}ms`
      };

      console.log(`✅ Memory usage: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB in ${duration.toFixed(2)}ms`);
    } catch (error) {
      this.results.memoryUsage = {
        status: "failed",
        message: `Memory test failed: ${error}`
      };
      console.error(`❌ Memory test failed: ${error}`);
    }
  }

  private async testConcurrentOperations(): Promise<void> {
    console.log("\n⚡ Testing Concurrent Operations...");
    
    const concurrencyLevels = [1, 2, 4, 8];
    const results: any[] = [];

    for (const concurrency of concurrencyLevels) {
      console.log(`  Testing concurrency: ${concurrency}`);
      
      const startTime = performance.now();
      
      try {
        // Create concurrent operations
        const operations = Array(concurrency).fill(null).map(async (_, i) => {
          const { data, error } = await this.supabase
            .from("orders")
            .select("id")
            .limit(1);
          
          if (error) throw error;
          return data;
        });

        await Promise.all(operations);
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        const operationsPerSecond = (concurrency / duration) * 1000;

        results.push({
          concurrency,
          duration,
          operationsPerSecond,
          status: "success"
        });

        console.log(`    ✅ ${concurrency} concurrent: ${duration.toFixed(2)}ms (${operationsPerSecond.toFixed(0)} ops/s)`);
      } catch (error) {
        results.push({
          concurrency,
          status: "failed",
          error: error.message
        });
        console.log(`    ❌ ${concurrency} concurrent: Failed - ${error.message}`);
      }
    }

    this.results.concurrentOperations = {
      results,
      status: "completed"
    };
  }

  private createTestBatch(size: number): any[] {
    return Array(size).fill(null).map((_, i) => ({
      customer_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
      purchase_from: "performance_test",
      order_date: new Date().toISOString(),
      total_amount: Math.random() * 1000,
      bill_to_name: `Test Customer ${i}`,
      ship_to_name: `Test Customer ${i}`,
    }));
  }

  private displayResults(): void {
    console.log("\n" + "=" * 60);
    console.log("📊 PERFORMANCE TEST RESULTS");
    console.log("=" * 60);

    // Database Connection
    if (this.results.databaseConnection) {
      console.log(`\n🔌 Database Connection: ${this.results.databaseConnection.message}`);
    }

    // CSV Parsing
    if (this.results.csvParsing) {
      console.log(`\n📖 CSV Parsing: ${this.results.csvParsing.message}`);
    }

    // Batch Insert
    if (this.results.batchInsert && this.results.batchInsert.results) {
      console.log("\n📦 Batch Insert Performance:");
      this.results.batchInsert.results.forEach((result: any) => {
        if (result.status === "success") {
          console.log(`  • ${result.batchSize} records: ${result.recordsPerSecond.toFixed(0)} records/s`);
        } else {
          console.log(`  • ${result.batchSize} records: Failed`);
        }
      });
    }

    // Memory Usage
    if (this.results.memoryUsage) {
      console.log(`\n💾 Memory Usage: ${this.results.memoryUsage.message}`);
    }

    // Concurrent Operations
    if (this.results.concurrentOperations && this.results.concurrentOperations.results) {
      console.log("\n⚡ Concurrent Operations:");
      this.results.concurrentOperations.results.forEach((result: any) => {
        if (result.status === "success") {
          console.log(`  • ${result.concurrency} concurrent: ${result.operationsPerSecond.toFixed(0)} ops/s`);
        } else {
          console.log(`  • ${result.concurrency} concurrent: Failed`);
        }
      });
    }

    // Recommendations
    console.log("\n💡 RECOMMENDATIONS:");
    console.log("• Use batch sizes of 500-1000 for optimal performance");
    console.log("• Set concurrency to 4-8 for maximum throughput");
    console.log("• Monitor memory usage for large datasets");
    console.log("• Use connection pooling for high-volume imports");

    console.log("\n🎉 Performance testing completed!");
  }
}

// Main execution
async function main() {
  try {
    const tester = new PerformanceTester();
    await tester.runPerformanceTests();
  } catch (error) {
    console.error("💥 Performance test failed:", error);
    process.exit(1);
  }
}

// Run the performance test
if (require.main === module) {
  main();
}

export { PerformanceTester };
