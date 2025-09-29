import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function createMissingOrderCosts() {
  try {
    console.log('🔧 Creating missing order_costs...\n');
    
    let processed = 0;
    let created = 0;
    const batchSize = 1000;
    let offset = 0;
    
    while (true) {
      console.log(`📦 Processing orders ${offset + 1} to ${offset + batchSize}...`);
      
      // Get a batch of orders
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id')
        .range(offset, offset + batchSize - 1);
      
      if (ordersError) {
        console.error('❌ Error fetching orders:', ordersError);
        break;
      }
      
      if (!orders || orders.length === 0) {
        console.log('✅ No more orders to process');
        break;
      }
      
      processed += orders.length;
      
      // Check which orders already have costs (in smaller batches to avoid 414 error)
      const orderIds = orders.map(o => o.id);
      const existingIds = new Set();
      
      // Process order IDs in smaller chunks
      const chunkSize = 100;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data: existingCosts, error: costsError } = await supabase
          .from('order_costs')
          .select('order_id')
          .in('order_id', chunk);
        
        if (costsError) {
          console.error('❌ Error checking existing costs:', costsError);
          break;
        }
        
        existingCosts?.forEach(cost => existingIds.add(cost.order_id));
      }
      
      const missingOrders = orders.filter(order => !existingIds.has(order.id));
      
      if (missingOrders.length > 0) {
        console.log(`💰 Creating costs for ${missingOrders.length} orders...`);
        
        const costRecords = missingOrders.map(order => ({
          order_id: order.id,
          casting: 0,
          diamond: 0,
          labor: 0
        }));
        
        const { error: insertError } = await supabase
          .from('order_costs')
          .insert(costRecords);
        
        if (insertError) {
          console.error('❌ Error inserting costs:', insertError);
          break;
        }
        
        created += missingOrders.length;
        console.log(`✅ Created ${missingOrders.length} cost records`);
      } else {
        console.log('✅ All orders in this batch already have costs');
      }
      
      offset += batchSize;
      
      // Safety check to prevent infinite loop
      if (processed > 100000) {
        console.log('⚠️  Safety limit reached (100k orders)');
        break;
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`📦 Orders processed: ${processed}`);
    console.log(`💰 Cost records created: ${created}`);
    
    // Final count
    const { count: finalCount } = await supabase
      .from('order_costs')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Total order_costs records: ${finalCount || 0}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createMissingOrderCosts();
