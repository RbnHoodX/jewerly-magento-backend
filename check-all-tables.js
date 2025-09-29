const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAllTables() {
  try {
    console.log('🔍 Checking all available tables...');
    
    // List of all possible table names to check
    const allTables = [
      'orders',
      'customers', 
      'order_items',
      'order_billing_address',
      'order_shipping_address',
      'order_comments',
      'order_costs',
      'order_diamonds',
      'order_casting',
      'order_3d_related',
      'order_employee_comments',
      'profiles',
      'diamond_inventory',
      'diamond_deductions',
      'diamond_movements',
      'order_verification',
      'order_files',
      'appraisals',
      'statuses_model',
      'email_logs',
      'invoices',
      'order_invoice'
    ];
    
    const existingTables = [];
    const missingTables = [];
    
    for (const tableName of allTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          missingTables.push(tableName);
          console.log(`❌ ${tableName}: ${error.message}`);
        } else {
          existingTables.push(tableName);
          console.log(`✅ ${tableName}: EXISTS`);
        }
      } catch (err) {
        missingTables.push(tableName);
        console.log(`❌ ${tableName}: ${err.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Existing tables: ${existingTables.length}`);
    console.log(`❌ Missing tables: ${missingTables.length}`);
    
    console.log(`\n✅ Existing tables:`);
    existingTables.forEach(table => console.log(`  - ${table}`));
    
    console.log(`\n❌ Missing tables:`);
    missingTables.forEach(table => console.log(`  - ${table}`));
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllTables();
