const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearAndReimport() {
  try {
    console.log('🔍 Clearing existing data and re-importing with correct orders...');
    
    // Step 1: Clear existing data in reverse order (to respect foreign keys)
    console.log('\n🧹 Step 1: Clearing existing data...');
    
    // Clear related data first
    console.log('🗑️ Clearing employee comments...');
    const { error: commentsError } = await supabase
      .from('order_employee_comments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (commentsError) {
      console.log('⚠️ Error clearing employee comments:', commentsError.message);
    } else {
      console.log('✅ Employee comments cleared');
    }
    
    console.log('🗑️ Clearing order costs...');
    const { error: costsError } = await supabase
      .from('order_costs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (costsError) {
      console.log('⚠️ Error clearing order costs:', costsError.message);
    } else {
      console.log('✅ Order costs cleared');
    }
    
    console.log('🗑️ Clearing diamond deductions...');
    const { error: diamondsError } = await supabase
      .from('diamond_deductions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (diamondsError) {
      console.log('⚠️ Error clearing diamond deductions:', diamondsError.message);
    } else {
      console.log('✅ Diamond deductions cleared');
    }
    
    console.log('🗑️ Clearing order casting...');
    const { error: castingError } = await supabase
      .from('order_casting')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (castingError) {
      console.log('⚠️ Error clearing order casting:', castingError.message);
    } else {
      console.log('✅ Order casting cleared');
    }
    
    console.log('🗑️ Clearing order 3d related...');
    const { error: threeDError } = await supabase
      .from('order_3d_related')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (threeDError) {
      console.log('⚠️ Error clearing order 3d related:', threeDError.message);
    } else {
      console.log('✅ Order 3d related cleared');
    }
    
    // Clear addresses
    console.log('🗑️ Clearing order addresses...');
    const { error: billingError } = await supabase
      .from('order_billing_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    const { error: shippingError } = await supabase
      .from('order_shipping_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (billingError || shippingError) {
      console.log('⚠️ Error clearing addresses:', billingError?.message || shippingError?.message);
    } else {
      console.log('✅ Order addresses cleared');
    }
    
    // Clear order items
    console.log('🗑️ Clearing order items...');
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (itemsError) {
      console.log('⚠️ Error clearing order items:', itemsError.message);
    } else {
      console.log('✅ Order items cleared');
    }
    
    // Clear customers
    console.log('🗑️ Clearing customers...');
    const { error: customersError } = await supabase
      .from('customers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (customersError) {
      console.log('⚠️ Error clearing customers:', customersError.message);
    } else {
      console.log('✅ Customers cleared');
    }
    
    // Clear orders last
    console.log('🗑️ Clearing orders...');
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (ordersError) {
      console.log('⚠️ Error clearing orders:', ordersError.message);
    } else {
      console.log('✅ Orders cleared');
    }
    
    console.log('\n✅ All existing data cleared!');
    console.log('\n🚀 Step 2: Now run the production import with correct main orders...');
    console.log('Run: npm run import-orders-production');
    console.log('\nThis will import the correct main orders from main_page.csv that match the related data!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearAndReimport();
