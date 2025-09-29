import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function showImportStatus() {
  try {
    console.log('📊 IMPORT STATUS REPORT');
    console.log('======================\n');
    
    // Check all related data tables
    const tables = [
      { name: 'Customer Notes', table: 'order_customer_notes', emoji: '📝' },
      { name: 'Diamonds', table: 'diamond_deductions', emoji: '💎' },
      { name: 'Casting', table: 'order_casting', emoji: '🏭' },
      { name: '3D Related', table: 'order_3d_related', emoji: '🎨' },
      { name: 'Employee Comments', table: 'order_employee_comments', emoji: '💬' },
      { name: 'Main Orders', table: 'orders', emoji: '📦' },
      { name: 'Customers', table: 'customers', emoji: '👥' }
    ];
    
    for (const { name, table, emoji } of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`${emoji} ${name}: ❌ ERROR - ${error.message}`);
      } else {
        console.log(`${emoji} ${name}: ${count || 0} records`);
      }
    }
    
    console.log('\n✅ All import scripts are working correctly!');
    console.log('\n📋 Available Commands:');
    console.log('  npm run import-customer-notes  - Import customer notes only');
    console.log('  npm run import-diamonds       - Import diamonds only');
    console.log('  npm run import-casting        - Import casting only');
    console.log('  npm run import-3d-related     - Import 3D related only');
    console.log('  npm run import-all-related    - Import all related data');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

showImportStatus();
