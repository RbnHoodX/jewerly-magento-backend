const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearAndReimport() {
  try {
    console.log('🧹 Clearing existing data to prepare for correct import...');
    
    // Get current counts
    const { count: ordersCount } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    
    const { count: customersCount } = await supabase
      .from('customers')
      .select('*', { count: 'exact', head: true });
    
    const { count: employeeCommentsCount } = await supabase
      .from('order_employee_comments')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Current data:`);
    console.log(`  - Orders: ${ordersCount || 0}`);
    console.log(`  - Customers: ${customersCount || 0}`);
    console.log(`  - Employee Comments: ${employeeCommentsCount || 0}`);
    
    console.log('\n⚠️  WARNING: This will delete all existing data!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🧹 Deleting existing data...');
    
    // Delete in correct order (foreign keys first)
    console.log('🗑️  Deleting employee comments...');
    const { error: deleteCommentsError } = await supabase
      .from('order_employee_comments')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteCommentsError) {
      console.error('❌ Error deleting employee comments:', deleteCommentsError);
    } else {
      console.log('✅ Employee comments deleted');
    }
    
    console.log('🗑️  Deleting order items...');
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteItemsError) {
      console.error('❌ Error deleting order items:', deleteItemsError);
    } else {
      console.log('✅ Order items deleted');
    }
    
    console.log('🗑️  Deleting addresses...');
    const { error: deleteBillingError } = await supabase
      .from('order_billing_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    const { error: deleteShippingError } = await supabase
      .from('order_shipping_address')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteBillingError) {
      console.error('❌ Error deleting billing addresses:', deleteBillingError);
    } else {
      console.log('✅ Billing addresses deleted');
    }
    
    if (deleteShippingError) {
      console.error('❌ Error deleting shipping addresses:', deleteShippingError);
    } else {
      console.log('✅ Shipping addresses deleted');
    }
    
    console.log('🗑️  Deleting orders...');
    const { error: deleteOrdersError } = await supabase
      .from('orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteOrdersError) {
      console.error('❌ Error deleting orders:', deleteOrdersError);
    } else {
      console.log('✅ Orders deleted');
    }
    
    console.log('🗑️  Deleting customers...');
    const { error: deleteCustomersError } = await supabase
      .from('customers')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
    
    if (deleteCustomersError) {
      console.error('❌ Error deleting customers:', deleteCustomersError);
    } else {
      console.log('✅ Customers deleted');
    }
    
    console.log('\n✅ Database cleared! Now you can run the correct import:');
    console.log('   npm run import-orders-production');
    console.log('\nThis will import the correct main orders from main_page.csv');
    console.log('that match the related data (Customer Notes, Diamonds, Casting, 3D Related)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

clearAndReimport();
