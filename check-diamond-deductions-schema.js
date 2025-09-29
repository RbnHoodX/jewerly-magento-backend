const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiamondDeductionsSchema() {
  try {
    console.log('🔍 Checking diamond_deductions table schema...');
    
    // Try to get a sample record to see the structure
    const { data, error } = await supabase
      .from('diamond_deductions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error getting diamond_deductions data:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Sample diamond_deductions record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📋 diamond_deductions table is empty');
      
      // Try to insert a test record with all possible fields
      const testRecord = {
        order_id: '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3', // Use the order ID we know exists
        type: 'diamond', // Add the missing type field
        ct_weight: 1.0,
        stones: 'Round',
        price_per_ct: 100.0,
        total_price: 100.0,
      };
      
      console.log('📝 Attempting to insert test record:', testRecord);
      
      const { data: insertData, error: insertError } = await supabase
        .from('diamond_deductions')
        .insert([testRecord]);
      
      if (insertError) {
        console.error('❌ Error inserting test record:', insertError);
      } else {
        console.log('✅ Test record inserted successfully:', insertData);
        
        // Clean up the test record
        await supabase
          .from('diamond_deductions')
          .delete()
          .eq('order_id', '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3');
        
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDiamondDeductionsSchema();