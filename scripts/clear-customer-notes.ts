import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function clearCustomerNotes() {
  try {
    console.log('🗑️  Clearing existing customer notes...\n');
    
    // Check current count
    const { count: beforeCount } = await supabase
      .from('order_customer_notes')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Current customer notes: ${beforeCount || 0}`);
    
    if (beforeCount === 0) {
      console.log('✅ No customer notes to clear');
      return;
    }
    
    // Clear all customer notes
    const { error } = await supabase
      .from('order_customer_notes')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (error) {
      console.error('❌ Error clearing customer notes:', error);
      return;
    }
    
    // Verify deletion
    const { count: afterCount } = await supabase
      .from('order_customer_notes')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Customer notes after clearing: ${afterCount || 0}`);
    console.log('✅ Customer notes cleared successfully!');
    console.log('\n💡 Now you can run: npm run import-customer-notes');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearCustomerNotes();
