const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRelatedData() {
  try {
    console.log('🔍 Checking related data in database...');
    
    // Check orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_id')
      .limit(5);
    
    if (ordersError) {
      console.error('❌ Error getting orders:', ordersError);
      return;
    }
    
    console.log('📦 Sample orders:');
    orders?.forEach(order => {
      console.log(`  - ID: ${order.id}, Order ID: ${order.order_id}`);
    });
    
    // Check customer notes
    const { count: notesCount, error: notesError } = await supabase
      .from('order_comments')
      .select('*', { count: 'exact', head: true });
    
    if (notesError) {
      console.error('❌ Error getting customer notes count:', notesError);
    } else {
      console.log(`📝 Customer notes count: ${notesCount}`);
    }
    
    // Check diamonds
    const { count: diamondsCount, error: diamondsError } = await supabase
      .from('order_diamonds')
      .select('*', { count: 'exact', head: true });
    
    if (diamondsError) {
      console.error('❌ Error getting diamonds count:', diamondsError);
    } else {
      console.log(`💎 Diamonds count: ${diamondsCount}`);
    }
    
    // Check casting
    const { count: castingCount, error: castingError } = await supabase
      .from('order_casting')
      .select('*', { count: 'exact', head: true });
    
    if (castingError) {
      console.error('❌ Error getting casting count:', castingError);
    } else {
      console.log(`🏭 Casting count: ${castingCount}`);
    }
    
    // Check 3D related
    const { count: threeDCount, error: threeDError } = await supabase
      .from('order_3d_related')
      .select('*', { count: 'exact', head: true });
    
    if (threeDError) {
      console.error('❌ Error getting 3D related count:', threeDError);
    } else {
      console.log(`🎨 3D Related count: ${threeDCount}`);
    }
    
    // Check employee comments
    const { count: commentsCount, error: commentsError } = await supabase
      .from('order_employee_comments')
      .select('*', { count: 'exact', head: true });
    
    if (commentsError) {
      console.error('❌ Error getting employee comments count:', commentsError);
    } else {
      console.log(`💬 Employee comments count: ${commentsCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRelatedData();
