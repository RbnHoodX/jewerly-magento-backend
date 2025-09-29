const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createOrderCommentsTable() {
  try {
    console.log('🔍 Creating order_comments table for customer notes...');
    
    // Create order_comments table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.order_comments (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_important BOOLEAN DEFAULT false,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    // Try to create the table using a direct SQL approach
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    });
    
    if (error) {
      console.log('❌ Error creating order_comments table:', error.message);
      console.log('Trying alternative approach...');
      
      // Try to insert a test record to see if table exists
      const testRecord = {
        order_id: '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3',
        content: 'Test comment',
        is_important: false,
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('order_comments')
        .insert([testRecord]);
      
      if (insertError) {
        console.log('❌ order_comments table does not exist:', insertError.message);
        console.log('We need to create it manually or use a different approach.');
      } else {
        console.log('✅ order_comments table exists and works!');
        
        // Clean up test record
        await supabase
          .from('order_comments')
          .delete()
          .eq('order_id', '5a83bb0b-7958-4de5-8df0-8ddb6ba320a3');
        
        console.log('🧹 Test record cleaned up');
      }
    } else {
      console.log('✅ order_comments table created successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createOrderCommentsTable();
