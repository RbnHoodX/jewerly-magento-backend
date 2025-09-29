import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixOrderCosts() {
  try {
    console.log('🔧 Fixing order_costs table...\n');
    
    // Get total counts
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    const { count: costsCount } = await supabase
      .from('order_costs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📦 Total orders: ${ordersCount || 0}`);
    console.log(`💰 Total order_costs: ${costsCount || 0}`);
    console.log(`📊 Missing: ${(ordersCount || 0) - (costsCount || 0)}`);
    
    if ((ordersCount || 0) === (costsCount || 0)) {
      console.log('✅ All orders have costs!');
      return;
    }
    
    // Get all order IDs that don't have costs
    const { data: missingOrders, error } = await supabase
      .rpc('get_orders_without_costs');
    
    if (error) {
      console.log('❌ RPC function not available, using alternative method...');
      
      // Alternative: Get all orders and filter
      const { data: allOrders } = await supabase
        .from('orders')
        .select('id');
      
      const { data: existingCosts } = await supabase
        .from('order_costs')
        .select('order_id');
      
      const existingIds = new Set(existingCosts?.map(c => c.order_id) || []);
      const missing = allOrders?.filter(o => !existingIds.has(o.id)) || [];
      
      console.log(`📦 Found ${missing.length} orders without costs`);
      
      if (missing.length > 0) {
        // Insert missing costs in batches
        const batchSize = 1000;
        for (let i = 0; i < missing.length; i += batchSize) {
          const batch = missing.slice(i, i + batchSize);
          const costRecords = batch.map(order => ({
            order_id: order.id,
            casting: 0,
            diamond: 0,
            labor: 0
          }));
          
          console.log(`💰 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missing.length/batchSize)} (${batch.length} records)`);
          
          const { error: insertError } = await supabase
            .from('order_costs')
            .insert(costRecords);
          
          if (insertError) {
            console.error(`❌ Error inserting batch:`, insertError);
            throw insertError;
          }
        }
        
        console.log('✅ All missing order costs created!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixOrderCosts();
