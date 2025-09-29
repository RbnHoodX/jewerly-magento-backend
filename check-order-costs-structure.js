const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderCostsStructure() {
  try {
    console.log('🔍 Checking order_costs table structure...');
    
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
      console.log('📋 order_costs table is empty');
      
      // Try to insert a test record to see what columns are expected
      const testRecord = {
        order_id: 'f9d795a9-3b7f-4651-b5d5-b885683a9aae', // Use the order ID we know exists
        casting: 100,
        diamond: 200,
        labor: 50
      };
      
      console.log('📝 Attempting to insert test record:', testRecord);
      
      const { data: insertData, error: insertError } = await supabase
        .from('order_costs')
        .insert([testRecord]);
      
      if (insertError) {
        console.error('❌ Error inserting test record:', insertError);
      } else {
        console.log('✅ Test record inserted successfully:', insertData);
        
        // Clean up the test record
        await supabase
          .from('order_costs')
          .delete()
          .eq('order_id', 'f9d795a9-3b7f-4651-b5d5-b885683a9aae');
        
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderCostsStructure();
