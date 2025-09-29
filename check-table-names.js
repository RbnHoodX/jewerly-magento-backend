const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTableNames() {
  try {
    console.log('🔍 Checking available tables in database...');
    
    // Try to get table information by attempting to select from various possible table names
    const possibleTables = [
      'order_comments',
      'order_costs', 
      'order_notes',
      'customer_notes',
      'order_diamonds',
      'order_casting',
      'order_3d_related',
      'order_employee_comments',
      'order_3d',
      'employee_comments',
      'diamonds',
      'casting',
      'three_d_related'
    ];
    
    console.log('📋 Testing table names:');
    
    for (const tableName of possibleTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: EXISTS (${data?.length || 0} records)`);
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTableNames();
