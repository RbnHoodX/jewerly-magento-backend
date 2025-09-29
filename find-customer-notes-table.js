const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function findCustomerNotesTable() {
  try {
    console.log('🔍 Looking for the correct table for customer notes...');
    
    // Try different possible table names for customer notes
    const possibleTables = [
      'order_comments',
      'order_notes', 
      'customer_notes',
      'notes',
      'order_feedback',
      'order_communication',
      'order_messages',
      'order_updates'
    ];
    
    for (const tableName of possibleTables) {
      try {
        console.log(`\n🔍 Testing table: ${tableName}`);
        
        // Try to get table info by attempting a simple select
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: EXISTS`);
          
          if (data && data.length > 0) {
            console.log(`📋 Sample record:`, JSON.stringify(data[0], null, 2));
          } else {
            console.log(`📋 Table is empty`);
          }
        }
      } catch (err) {
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    // Also check if there are any tables with 'comment' in the name
    console.log('\n🔍 Checking for tables with "comment" in the name...');
    const commentTables = [
      'comments',
      'order_comment',
      'customer_comment',
      'order_feedback_comments'
    ];
    
    for (const tableName of commentTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          console.log(`✅ ${tableName}: EXISTS`);
          if (data && data.length > 0) {
            console.log(`📋 Sample record:`, JSON.stringify(data[0], null, 2));
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

findCustomerNotesTable();
