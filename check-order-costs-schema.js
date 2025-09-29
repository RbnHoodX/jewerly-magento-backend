const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderCostsSchema() {
  try {
    console.log('🔍 Checking order_costs table schema...');
    
    // Try to get a sample record to see the structure
    const { data, error } = await supabase
      .from('order_costs')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error getting order_costs data:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Sample order_costs record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📋 order_costs table is empty, trying to insert a test record...');
      
      // Try to insert a minimal test record to see what columns are expected
      const testRecord = {
        order_id: 'f9d795a9-3b7f-4651-b5d5-b885683a9aae', // Use the order ID we know exists
        cost_type: 'customer_note',
        amount: 0,
        description: 'Test customer note'
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('order_costs')
        .insert([testRecord]);
      
      if (insertError) {
        console.error('❌ Error inserting test record:', insertError);
        console.error('Expected columns might be:', insertError.message);
      } else {
        console.log('✅ Test record inserted successfully:', insertData);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderCostsSchema();