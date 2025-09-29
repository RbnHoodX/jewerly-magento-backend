const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderCostsCount() {
  try {
    console.log('🔍 Checking order_costs table (customer notes)...');
    
    const { count, error } = await supabase
      .from('order_costs')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log(`📝 Customer notes (order_costs): ${count || 0} records`);
    }
    
    // Check diamond_deductions
    const { count: diamondCount, error: diamondError } = await supabase
      .from('diamond_deductions')
      .select('*', { count: 'exact', head: true });
    
    if (diamondError) {
      console.error('❌ Diamond error:', diamondError);
    } else {
      console.log(`💎 Diamonds (diamond_deductions): ${diamondCount || 0} records`);
    }
    
    // Check order_casting
    const { count: castingCount, error: castingError } = await supabase
      .from('order_casting')
      .select('*', { count: 'exact', head: true });
    
    if (castingError) {
      console.error('❌ Casting error:', castingError);
    } else {
      console.log(`🏭 Casting: ${castingCount || 0} records`);
    }
    
    // Check order_3d_related
    const { count: threeDCount, error: threeDError } = await supabase
      .from('order_3d_related')
      .select('*', { count: 'exact', head: true });
    
    if (threeDError) {
      console.error('❌ 3D error:', threeDError);
    } else {
      console.log(`🎨 3D Related: ${threeDCount || 0} records`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderCostsCount();
