const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testOrderCustomerNotes() {
  try {
    console.log('🔍 Testing order_customer_notes table...');
    
    // Try to get a sample record to see the structure
    const { data, error } = await supabase
      .from('order_customer_notes')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error getting order_customer_notes data:', error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log('📋 Sample order_customer_notes record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📋 order_customer_notes table is empty');
      
      // Try to insert a test record
      const testRecord = {
        order_id: '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3', // Use the order ID we know exists
        content: 'Test customer note',
        is_important: false,
        created_by: null,
      };
      
      console.log('📝 Attempting to insert test record:', testRecord);
      
      const { data: insertData, error: insertError } = await supabase
        .from('order_customer_notes')
        .insert([testRecord]);
      
      if (insertError) {
        console.error('❌ Error inserting test record:', insertError);
      } else {
        console.log('✅ Test record inserted successfully:', insertData);
        
        // Clean up the test record
        await supabase
          .from('order_customer_notes')
          .delete()
          .eq('order_id', '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3');
        
        console.log('🧹 Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testOrderCustomerNotes();
