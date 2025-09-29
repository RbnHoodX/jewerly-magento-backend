import { createClient } from '@supabase/supabase-js';

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function recreateOrderCostsTable() {
  try {
    console.log('🔧 Recreating order_costs table with proper foreign key...\n');
    
    // Step 1: Backup existing data
    console.log('📦 Backing up existing order_costs data...');
    const { data: existingData, error: backupError } = await supabase
      .from('order_costs')
      .select('*');
    
    if (backupError) {
      console.log('❌ Error backing up data:', backupError.message);
      return;
    }
    
    console.log(`📊 Backed up ${existingData?.length || 0} records`);
    
    // Step 2: Drop the existing table
    console.log('🗑️  Dropping existing order_costs table...');
    const { error: dropError } = await supabase
      .rpc('exec_sql', { 
        sql: 'DROP TABLE IF EXISTS public.order_costs CASCADE;' 
      });
    
    if (dropError) {
      console.log('❌ Error dropping table:', dropError.message);
      console.log('💡 Will try alternative approach...');
    } else {
      console.log('✅ Table dropped successfully');
    }
    
    // Step 3: Recreate the table with proper foreign key
    console.log('🔨 Recreating order_costs table...');
    const { error: createError } = await supabase
      .rpc('exec_sql', { 
        sql: `
          CREATE TABLE public.order_costs (
            order_id UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
            casting NUMERIC DEFAULT 0,
            diamond NUMERIC DEFAULT 0,
            labor NUMERIC DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        ` 
      });
    
    if (createError) {
      console.log('❌ Error creating table:', createError.message);
      console.log('💡 The table might already exist with different structure');
      
      // Alternative: Try to add the foreign key constraint to existing table
      console.log('🔗 Trying to add foreign key constraint to existing table...');
      
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
        console.log('❌ Error adding foreign key:', fkError.message);
        console.log('💡 The constraint might already exist or there might be data issues');
      } else {
        console.log('✅ Foreign key constraint added successfully');
      }
    } else {
      console.log('✅ Table created successfully');
      
      // Step 4: Restore the data
      if (existingData && existingData.length > 0) {
        console.log('📥 Restoring data...');
        
        const { error: restoreError } = await supabase
          .from('order_costs')
          .insert(existingData);
        
        if (restoreError) {
          console.log('❌ Error restoring data:', restoreError.message);
        } else {
          console.log(`✅ Restored ${existingData.length} records`);
        }
      }
    }
    
    // Step 5: Test the relationship
    console.log('\n🔍 Testing the relationship...');
    const { data: testData, error: testError } = await supabase
      .from('orders')
      .select('id, order_costs(*)')
      .limit(1);
    
    if (testError) {
      console.log('❌ Relationship test failed:', testError.message);
    } else {
      console.log('✅ Relationship test passed!');
      console.log('📊 Test result:', JSON.stringify(testData?.[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

recreateOrderCostsTable();
