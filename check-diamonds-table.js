const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDiamondsTable() {
  try {
    console.log('🔍 Checking for diamonds table...');
    
    // Try different possible table names for diamonds
    const possibleDiamondTables = [
      'order_diamonds',
      'diamonds',
      'order_diamond',
      'diamond',
      'order_items',
      'items'
    ];
    
    for (const tableName of possibleDiamondTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: EXISTS (${data?.length || 0} records)`);
          
          // If we found a table, let's see its structure
          if (data && data.length > 0) {
            console.log(`📋 Sample record from ${tableName}:`, data[0]);
          }
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDiamondsTable();
