import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixOrderCostsForeignKey() {
  try {
    console.log('🔧 Fixing order_costs foreign key relationship...\n');
    
    // Check if the foreign key constraint exists
    const { data: constraints, error: constraintError } = await supabase
      .rpc('get_foreign_keys', { table_name: 'order_costs' });
    
    if (constraintError) {
      console.log('❌ Error checking constraints:', constraintError.message);
      console.log('💡 Will try to create the foreign key constraint...');
    } else {
      console.log('📊 Existing foreign key constraints:', constraints);
    }
    
    // Try to add the foreign key constraint
    console.log('🔗 Adding foreign key constraint...');
    
    const { error: fkError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          ALTER TABLE public.order_costs 
          ADD CONSTRAINT order_costs_order_id_fkey 
          FOREIGN KEY (order_id) 
          REFERENCES public.orders(id) 
          ON DELETE CASCADE;
        ` 
      });
    
    if (fkError) {
      console.log('❌ Error creating foreign key:', fkError.message);
      
      // Alternative approach: Check if the constraint already exists with a different name
      console.log('💡 Trying to find existing constraint...');
      
      const { data: existingConstraints, error: checkError } = await supabase
        .from('information_schema.table_constraints')
        .select('constraint_name, constraint_type')
        .eq('table_name', 'order_costs')
        .eq('constraint_type', 'FOREIGN KEY');
      
      if (checkError) {
        console.log('❌ Error checking existing constraints:', checkError.message);
      } else {
        console.log('📊 Existing foreign key constraints:', existingConstraints);
      }
      
      // Try a different approach - check if the relationship works without explicit constraint
      console.log('🔍 Testing if relationship works without explicit constraint...');
      
      const { data: testData, error: testError } = await supabase
        .from('orders')
        .select('id, order_costs(*)')
        .limit(1);
      
      if (testError) {
        console.log('❌ Relationship still not working:', testError.message);
        console.log('💡 The issue might be that the order_costs table structure is different than expected');
        
        // Check the actual structure of order_costs table
        const { data: sampleCost, error: sampleError } = await supabase
          .from('order_costs')
          .select('*')
          .limit(1);
        
        if (sampleError) {
          console.log('❌ Error fetching sample order_costs:', sampleError.message);
        } else {
          console.log('📊 Sample order_costs record:', JSON.stringify(sampleCost?.[0], null, 2));
        }
      } else {
        console.log('✅ Relationship is working!');
        console.log('📊 Test data:', JSON.stringify(testData?.[0], null, 2));
      }
    } else {
      console.log('✅ Foreign key constraint created successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixOrderCostsForeignKey();
