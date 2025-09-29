import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkOrderCostsStructure() {
  try {
    console.log('🔍 Checking order_costs table structure...\n');
    
    // Get a sample record to see the actual structure
    const { data: sample, error: sampleError } = await supabase
      .from('order_costs')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.log('❌ Error fetching sample:', sampleError.message);
      return;
    }
    
    console.log('📊 Sample order_costs record:');
    console.log(JSON.stringify(sample?.[0], null, 2));
    
    // Check if we can query with the relationship
    console.log('\n🔍 Testing different query approaches...');
    
    // Test 1: Direct query
    const { data: directData, error: directError } = await supabase
      .from('order_costs')
      .select('*')
      .limit(1);
    
    if (directError) {
      console.log('❌ Direct query failed:', directError.message);
    } else {
      console.log('✅ Direct query works');
    }
    
    // Test 2: Try to join from orders
    const { data: joinData, error: joinError } = await supabase
      .from('orders')
      .select('id, order_costs(*)')
      .limit(1);
    
    if (joinError) {
      console.log('❌ Join query failed:', joinError.message);
    } else {
      console.log('✅ Join query works');
      console.log('📊 Join result:', JSON.stringify(joinData?.[0], null, 2));
    }
    
    // Test 3: Check if the issue is with the column name
    console.log('\n🔍 Testing with explicit column mapping...');
    
    const { data: explicitData, error: explicitError } = await supabase
      .from('orders')
      .select(`
        id,
        order_costs!order_costs_order_id_fkey(*)
      `)
      .limit(1);
    
    if (explicitError) {
      console.log('❌ Explicit foreign key failed:', explicitError.message);
    } else {
      console.log('✅ Explicit foreign key works');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderCostsStructure();
