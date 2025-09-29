const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugOrderIds() {
  try {
    console.log('🔍 Debugging order IDs in database...');
    
    // Get a broader range of order IDs from the database
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_id')
      .order('order_id', { ascending: true })
      .limit(50);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log('📦 First 50 order IDs in database:');
    orders.forEach((order, index) => {
      console.log(`  ${index + 1}. Order ID: ${order.order_id} (type: ${typeof order.order_id})`);
    });
    
    // Check if we have orders with IDs that match the related data
    const testOrderIds = ['45', '50742', '50745', '26689', '52467'];
    console.log('\n🔍 Checking for specific order IDs from related data:');
    
    for (const testId of testOrderIds) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id')
        .eq('order_id', testId)
        .single();
      
      if (orderError) {
        console.log(`❌ Order ${testId}: ${orderError.message}`);
      } else {
        console.log(`✅ Order ${testId}: Found (ID: ${order.id})`);
      }
    }
    
    // Get total count and range
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting count:', countError);
    } else {
      console.log(`\n📊 Total orders in database: ${count}`);
    }
    
    // Get min and max order IDs
    const { data: minOrder, error: minError } = await supabase
      .from('orders')
      .select('order_id')
      .order('order_id', { ascending: true })
      .limit(1);
    
    const { data: maxOrder, error: maxError } = await supabase
      .from('orders')
      .select('order_id')
      .order('order_id', { ascending: false })
      .limit(1);
    
    if (!minError && !maxError && minOrder && maxOrder) {
      console.log(`📈 Order ID range: ${minOrder[0].order_id} to ${maxOrder[0].order_id}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugOrderIds();
