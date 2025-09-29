const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderIds() {
  try {
    console.log('🔍 Checking order IDs in database...');
    
    // Get a sample of order IDs from the database
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('order_id')
      .limit(20);
    
    if (ordersError) {
      console.error('❌ Error getting orders:', ordersError);
      return;
    }
    
    console.log('📦 Sample order IDs in database:');
    orders?.forEach(order => {
      console.log(`  - ${order.order_id}`);
    });
    
    // Check if order ID 45 exists (from customer notes)
    const { data: order45, error: order45Error } = await supabase
      .from('orders')
      .select('id, order_id')
      .eq('order_id', 45)
      .single();
    
    if (order45Error) {
      console.log('❌ Order 45 not found:', order45Error.message);
    } else {
      console.log('✅ Order 45 found:', order45);
    }
    
    // Check if order ID 50742 exists (from diamonds)
    const { data: order50742, error: order50742Error } = await supabase
      .from('orders')
      .select('id, order_id')
      .eq('order_id', 50742)
      .single();
    
    if (order50742Error) {
      console.log('❌ Order 50742 not found:', order50742Error.message);
    } else {
      console.log('✅ Order 50742 found:', order50742);
    }
    
    // Get total count of orders
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting order count:', countError);
    } else {
      console.log(`📊 Total orders in database: ${count}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderIds();
