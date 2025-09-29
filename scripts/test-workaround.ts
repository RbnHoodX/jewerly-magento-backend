import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testWorkaround() {
  try {
    console.log('🔧 Testing workaround for order_costs relationship...\n');
    
    // Test 1: Get orders without the relationship
    console.log('📦 Testing orders query without order_costs...');
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_id,
        shopify_order_number,
        customer_id,
        purchase_from,
        order_date,
        total_amount,
        delivery_method,
        created_at,
        customization_notes,
        how_did_you_hear,
        customers (*),
        order_items (*),
        order_billing_address (*),
        order_shipping_address (*),
        order_customer_notes (*)
      `)
      .limit(1);
    
    if (ordersError) {
      console.log('❌ Orders query failed:', ordersError.message);
    } else {
      console.log('✅ Orders query works without order_costs');
      console.log('📊 Sample order:', JSON.stringify(ordersData?.[0], null, 2));
    }
    
    // Test 2: Get order_costs separately
    console.log('\n💰 Testing separate order_costs query...');
    const { data: costsData, error: costsError } = await supabase
      .from('order_costs')
      .select('*')
      .limit(1);
    
    if (costsError) {
      console.log('❌ Order_costs query failed:', costsError.message);
    } else {
      console.log('✅ Order_costs query works');
      console.log('📊 Sample cost:', JSON.stringify(costsData?.[0], null, 2));
    }
    
    // Test 3: Manual join approach
    console.log('\n🔗 Testing manual join approach...');
    const { data: manualJoinData, error: manualJoinError } = await supabase
      .from('orders')
      .select(`
        id,
        order_id,
        order_costs!left(*)
      `)
      .limit(1);
    
    if (manualJoinError) {
      console.log('❌ Manual join failed:', manualJoinError.message);
    } else {
      console.log('✅ Manual join works');
      console.log('📊 Manual join result:', JSON.stringify(manualJoinData?.[0], null, 2));
    }
    
    console.log('\n💡 SOLUTION: The frontend needs to be updated to:');
    console.log('1. Remove order_costs from the main query');
    console.log('2. Fetch order_costs separately using the order_id');
    console.log('3. Combine the data in the frontend');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWorkaround();
