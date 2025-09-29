const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkExistingOrders() {
  try {
    console.log('🔍 Checking existing orders in database...');
    
    // Get count of orders
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Error getting order count:', countError);
      return;
    }
    
    console.log(`📊 Total orders in database: ${count}`);
    
    // Get a few sample orders
    const { data: sampleOrders, error: sampleError } = await supabase
      .from('orders')
      .select('order_id, customer_id, total_amount, order_date')
      .limit(5);
    
    if (sampleError) {
      console.error('❌ Error getting sample orders:', sampleError);
      return;
    }
    
    console.log('📋 Sample orders:');
    sampleOrders?.forEach(order => {
      console.log(`  - Order ID: ${order.order_id}, Customer: ${order.customer_id}, Amount: ${order.total_amount}, Date: ${order.order_date}`);
    });
    
    // Check if order_id "45" exists (as string)
    const { data: order45Str, error: order45StrError } = await supabase
      .from('orders')
      .select('order_id, customer_id, total_amount')
      .eq('order_id', '45')
      .single();
    
    if (order45StrError) {
      console.log('❌ Order 45 (string) not found or error:', order45StrError.message);
    } else {
      console.log('✅ Order 45 (string) found:', order45Str);
    }
    
    // Check if order_id 45 exists (as number)
    const { data: order45Num, error: order45NumError } = await supabase
      .from('orders')
      .select('order_id, customer_id, total_amount')
      .eq('order_id', 45)
      .single();
    
    if (order45NumError) {
      console.log('❌ Order 45 (number) not found or error:', order45NumError.message);
    } else {
      console.log('✅ Order 45 (number) found:', order45Num);
    }
    
    // Check what type the order_id is stored as
    const { data: sampleOrder, error: sampleOrderError } = await supabase
      .from('orders')
      .select('order_id')
      .limit(1)
      .single();
    
    if (sampleOrderError) {
      console.log('❌ Error getting sample order:', sampleOrderError.message);
    } else {
      console.log('📋 Sample order_id type:', typeof sampleOrder.order_id, 'Value:', sampleOrder.order_id);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkExistingOrders();
