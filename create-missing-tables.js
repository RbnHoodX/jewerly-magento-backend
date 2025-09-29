const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createMissingTables() {
  try {
    console.log('🔍 Creating missing tables...');
    
    // Create order_comments table
    console.log('📝 Creating order_comments table...');
    const createOrderCommentsSQL = `
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
    
    const { data: commentsResult, error: commentsError } = await supabase.rpc('exec_sql', {
      sql: createOrderCommentsSQL
    });
    
    if (commentsError) {
      console.log('❌ Error creating order_comments:', commentsError.message);
    } else {
      console.log('✅ order_comments table created successfully');
    }
    
    // Create order_diamonds table
    console.log('💎 Creating order_diamonds table...');
    const createOrderDiamondsSQL = `
      CREATE TABLE IF NOT EXISTS public.order_diamonds (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
        carat_weight DECIMAL(10,3),
        color VARCHAR(50),
        clarity VARCHAR(50),
        cut VARCHAR(50),
        shape VARCHAR(50),
        price DECIMAL(10,2),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    const { data: diamondsResult, error: diamondsError } = await supabase.rpc('exec_sql', {
      sql: createOrderDiamondsSQL
    });
    
    if (diamondsError) {
      console.log('❌ Error creating order_diamonds:', diamondsError.message);
    } else {
      console.log('✅ order_diamonds table created successfully');
    }
    
    // Check if tables now exist
    console.log('\n🔍 Checking if tables now exist...');
    
    const { data: commentsData, error: commentsCheckError } = await supabase
      .from('order_comments')
      .select('*')
      .limit(1);
    
    if (commentsCheckError) {
      console.log('❌ order_comments still not accessible:', commentsCheckError.message);
    } else {
      console.log('✅ order_comments table is now accessible');
    }
    
    const { data: diamondsData, error: diamondsCheckError } = await supabase
      .from('order_diamonds')
      .select('*')
      .limit(1);
    
    if (diamondsCheckError) {
      console.log('❌ order_diamonds still not accessible:', diamondsCheckError.message);
    } else {
      console.log('✅ order_diamonds table is now accessible');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createMissingTables();