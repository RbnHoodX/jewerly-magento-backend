const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrdersSchema() {
  try {
    console.log('🔍 Testing orders table insert...');
    
    // Try to insert a test record to see what happens
    const testOrder = {
      customer_id: '00000000-0000-0000-0000-000000000000',
      purchase_from: 'test',
      order_date: '2025-01-01',
      total_amount: 100.00
    };

    console.log('🧪 Inserting test order:', testOrder);
    const { data: insertData, error: insertError } = await supabase
      .from('orders')
      .insert(testOrder)
      .select();

    if (insertError) {
      console.error('❌ Insert error:', insertError.message);
      console.error('Code:', insertError.code);
      console.error('Details:', insertError.details);
      console.error('Hint:', insertError.hint);
    } else {
      console.log('✅ Insert successful:', insertData);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrdersSchema();
