import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function populateOrderCosts() {
  try {
    console.log('💰 Populating order_costs table...\n');
    
    // Check current count
    const { count: existingCount } = await supabase
      .from('order_costs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Current order_costs records: ${existingCount || 0}`);
    
    // Get all orders in batches
    const { data: allOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id');
    
    if (ordersError) {
      console.error('❌ Error fetching orders:', ordersError);
      return;
    }
    
    // Get existing order_costs to avoid duplicates
    const { data: existingCosts, error: costsError } = await supabase
      .from('order_costs')
      .select('order_id');
    
    if (costsError) {
      console.error('❌ Error fetching existing costs:', costsError);
      return;
    }
    
    const existingOrderIds = new Set(existingCosts?.map(c => c.order_id) || []);
    const orders = allOrders?.filter(order => !existingOrderIds.has(order.id)) || [];
    
    console.log(`📦 Found ${orders?.length || 0} orders without costs`);
    
    if (!orders || orders.length === 0) {
      console.log('✅ All orders already have costs');
      return;
    }
    
    // Create default cost records for all orders
    const costRecords = orders.map(order => ({
      order_id: order.id,
      casting: 0,
      diamond: 0,
      labor: 0
    }));
    
    console.log(`💰 Creating ${costRecords.length} cost records...`);
    
    // Insert in batches of 1000
    const batchSize = 1000;
    const batches = [];
    for (let i = 0; i < costRecords.length; i += batchSize) {
      batches.push(costRecords.slice(i, i + batchSize));
    }
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`💰 Processing batch ${i + 1}/${batches.length} (${batch.length} records)`);
      
      const { error } = await supabase
        .from('order_costs')
        .insert(batch);
      
      if (error) {
        console.error(`❌ Error inserting batch ${i + 1}:`, error);
        throw error;
      }
    }
    
    // Verify insertion
    const { count: finalCount } = await supabase
      .from('order_costs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Final order_costs records: ${finalCount || 0}`);
    console.log('✅ Order costs populated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

populateOrderCosts();
