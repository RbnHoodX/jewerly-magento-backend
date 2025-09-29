// COMPREHENSIVE ROLLBACK SCRIPT FOR FAILED IMPORTS
// This script safely removes all imported data and restores the database to its pre-import state

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { performance } from "perf_hooks";

class ImportRollback {
  private supabase: any;
  private logger: any;

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

    this.logger = {
      log: (message: string) => {
        const timestamp = new Date().toISOString().substr(11, 12);
        console.log(`[${timestamp}] ROLLBACK: ${message}`);
      },
      info: (message: string) => this.logger.log(`ℹ️  ${message}`),
      success: (message: string) => this.logger.log(`✅ ${message}`),
      warn: (message: string) => this.logger.log(`⚠️  ${message}`),
      error: (message: string) => this.logger.log(`❌ ${message}`),
    };
  }

  async rollbackAllImportedData(): Promise<void> {
    const startTime = performance.now();
    
    try {
      this.logger.info("🔄 Starting comprehensive rollback of imported data...");
      this.logger.warn("⚠️  This will remove ALL data imported with 'legacy_import' source");
      
      // Step 1: Get counts before deletion
      await this.getPreRollbackCounts();
      
      // Step 2: Delete in correct order (respecting foreign key constraints)
      await this.deleteOrderItems();
      await this.deleteOrderAddresses();
      await this.deleteOrderComments();
      await this.deleteOrderCasting();
      await this.deleteOrder3D();
      await this.deleteOrderEmployeeComments();
      await this.deleteOrders();
      await this.deleteImportedCustomers();
      
      // Step 3: Verify rollback
      await this.verifyRollback();
      
      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      
      this.logger.success(`🎉 Rollback completed successfully in ${duration.toFixed(2)}s`);
      this.logger.info("✅ Database has been restored to pre-import state");
      
    } catch (error) {
      this.logger.error("💥 Rollback failed:", error);
      throw error;
    }
  }

  private async getPreRollbackCounts(): Promise<void> {
    this.logger.info("📊 Getting pre-rollback counts...");
    
    try {
      // Count orders
      const { count: orderCount } = await this.supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("purchase_from", "legacy_import");
      
      // Count customers
      const { count: customerCount } = await this.supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
      
      // Count order items
      const { count: itemCount } = await this.supabase
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .in("order_id", await this.getOrderIds());
      
      this.logger.info(`📊 Pre-rollback counts:`);
      this.logger.info(`   • Orders: ${orderCount || 0}`);
      this.logger.info(`   • Customers: ${customerCount || 0}`);
      this.logger.info(`   • Order Items: ${itemCount || 0}`);
      
    } catch (error) {
      this.logger.warn(`⚠️  Could not get pre-rollback counts: ${error.message}`);
    }
  }

  private async getOrderIds(): Promise<string[]> {
    try {
      const { data: orders } = await this.supabase
        .from("orders")
        .select("id")
        .eq("purchase_from", "legacy_import");
      
      return orders?.map(order => order.id) || [];
    } catch (error) {
      this.logger.warn(`⚠️  Could not get order IDs: ${error.message}`);
      return [];
    }
  }

  private async deleteOrderItems(): Promise<void> {
    this.logger.info("🗑️  Deleting order items...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order items to delete");
        return;
      }

      const { error } = await this.supabase
        .from("order_items")
        .delete()
        .in("order_id", orderIds);

      if (error) {
        this.logger.error(`   Failed to delete order items: ${error.message}`);
        throw error;
      }

      this.logger.success(`   ✅ Deleted order items for ${orderIds.length} orders`);
    } catch (error) {
      this.logger.error(`   ❌ Failed to delete order items: ${error.message}`);
      throw error;
    }
  }

  private async deleteOrderAddresses(): Promise<void> {
    this.logger.info("🗑️  Deleting order addresses...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order addresses to delete");
        return;
      }

      // Delete billing addresses
      const { error: billingError } = await this.supabase
        .from("order_billing_address")
        .delete()
        .in("order_id", orderIds);

      if (billingError) {
        this.logger.error(`   Failed to delete billing addresses: ${billingError.message}`);
        throw billingError;
      }

      // Delete shipping addresses
      const { error: shippingError } = await this.supabase
        .from("order_shipping_address")
        .delete()
        .in("order_id", orderIds);

      if (shippingError) {
        this.logger.error(`   Failed to delete shipping addresses: ${shippingError.message}`);
        throw shippingError;
      }

      this.logger.success(`   ✅ Deleted addresses for ${orderIds.length} orders`);
    } catch (error) {
      this.logger.error(`   ❌ Failed to delete order addresses: ${error.message}`);
      throw error;
    }
  }

  private async deleteOrderComments(): Promise<void> {
    this.logger.info("🗑️  Deleting order comments...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order comments to delete");
        return;
      }

      const { error } = await this.supabase
        .from("order_comments")
        .delete()
        .in("order_id", orderIds);

      if (error) {
        this.logger.warn(`   ⚠️  Could not delete order comments (table may not exist): ${error.message}`);
      } else {
        this.logger.success(`   ✅ Deleted order comments for ${orderIds.length} orders`);
      }
    } catch (error) {
      this.logger.warn(`   ⚠️  Could not delete order comments: ${error.message}`);
    }
  }

  private async deleteOrderCasting(): Promise<void> {
    this.logger.info("🗑️  Deleting order casting data...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order casting data to delete");
        return;
      }

      const { error } = await this.supabase
        .from("order_casting")
        .delete()
        .in("order_id", orderIds);

      if (error) {
        this.logger.warn(`   ⚠️  Could not delete order casting (table may not exist): ${error.message}`);
      } else {
        this.logger.success(`   ✅ Deleted order casting for ${orderIds.length} orders`);
      }
    } catch (error) {
      this.logger.warn(`   ⚠️  Could not delete order casting: ${error.message}`);
    }
  }

  private async deleteOrder3D(): Promise<void> {
    this.logger.info("🗑️  Deleting order 3D data...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order 3D data to delete");
        return;
      }

      const { error } = await this.supabase
        .from("order_3d_related")
        .delete()
        .in("order_id", orderIds);

      if (error) {
        this.logger.warn(`   ⚠️  Could not delete order 3D data (table may not exist): ${error.message}`);
      } else {
        this.logger.success(`   ✅ Deleted order 3D data for ${orderIds.length} orders`);
      }
    } catch (error) {
      this.logger.warn(`   ⚠️  Could not delete order 3D data: ${error.message}`);
    }
  }

  private async deleteOrderEmployeeComments(): Promise<void> {
    this.logger.info("🗑️  Deleting order employee comments...");
    
    try {
      const orderIds = await this.getOrderIds();
      if (orderIds.length === 0) {
        this.logger.info("   No order employee comments to delete");
        return;
      }

      const { error } = await this.supabase
        .from("order_employee_comments")
        .delete()
        .in("order_id", orderIds);

      if (error) {
        this.logger.warn(`   ⚠️  Could not delete order employee comments (table may not exist): ${error.message}`);
      } else {
        this.logger.success(`   ✅ Deleted order employee comments for ${orderIds.length} orders`);
      }
    } catch (error) {
      this.logger.warn(`   ⚠️  Could not delete order employee comments: ${error.message}`);
    }
  }

  private async deleteOrders(): Promise<void> {
    this.logger.info("🗑️  Deleting orders...");
    
    try {
      const { error } = await this.supabase
        .from("orders")
        .delete()
        .eq("purchase_from", "legacy_import");

      if (error) {
        this.logger.error(`   Failed to delete orders: ${error.message}`);
        throw error;
      }

      this.logger.success("   ✅ Deleted all imported orders");
    } catch (error) {
      this.logger.error(`   ❌ Failed to delete orders: ${error.message}`);
      throw error;
    }
  }

  private async deleteImportedCustomers(): Promise<void> {
    this.logger.info("🗑️  Deleting imported customers...");
    
    try {
      // Get customers created in the last 24 hours (imported customers)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      
      const { error } = await this.supabase
        .from("customers")
        .delete()
        .gte("created_at", yesterday);

      if (error) {
        this.logger.error(`   Failed to delete imported customers: ${error.message}`);
        throw error;
      }

      this.logger.success("   ✅ Deleted imported customers");
    } catch (error) {
      this.logger.error(`   ❌ Failed to delete imported customers: ${error.message}`);
      throw error;
    }
  }

  private async verifyRollback(): Promise<void> {
    this.logger.info("🔍 Verifying rollback...");
    
    try {
      // Check orders
      const { count: orderCount } = await this.supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("purchase_from", "legacy_import");
      
      if (orderCount && orderCount > 0) {
        this.logger.error(`❌ Rollback verification failed: ${orderCount} orders still exist`);
        throw new Error("Rollback verification failed");
      }

      this.logger.success("✅ Rollback verification passed - no imported data remains");
    } catch (error) {
      this.logger.error(`❌ Rollback verification failed: ${error.message}`);
      throw error;
    }
  }

  async getRollbackStatus(): Promise<void> {
    this.logger.info("📊 Checking rollback status...");
    
    try {
      // Check for imported orders
      const { count: orderCount } = await this.supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("purchase_from", "legacy_import");
      
      // Check for recent customers
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: customerCount } = await this.supabase
        .from("customers")
        .select("*", { count: "exact", head: true })
        .gte("created_at", yesterday);
      
      this.logger.info(`📊 Current status:`);
      this.logger.info(`   • Imported orders: ${orderCount || 0}`);
      this.logger.info(`   • Recent customers: ${customerCount || 0}`);
      
      if (orderCount && orderCount > 0) {
        this.logger.warn("⚠️  Imported data detected - rollback may be needed");
      } else {
        this.logger.success("✅ No imported data detected - database is clean");
      }
      
    } catch (error) {
      this.logger.error(`❌ Could not check rollback status: ${error.message}`);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    const rollback = new ImportRollback();

    if (command === "status") {
      await rollback.getRollbackStatus();
    } else if (command === "rollback") {
      console.log("⚠️  WARNING: This will delete ALL imported data!");
      console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...");
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      await rollback.rollbackAllImportedData();
    } else {
      console.log("Usage:");
      console.log("  npm run rollback status    - Check rollback status");
      console.log("  npm run rollback rollback  - Perform full rollback");
    }

  } catch (error) {
    console.error("💥 Rollback failed:", error);
    process.exit(1);
  }
}

// Run the rollback
if (require.main === module) {
  main();
}

export { ImportRollback };
