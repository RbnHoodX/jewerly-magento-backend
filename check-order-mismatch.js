const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkOrderMismatch() {
  try {
    console.log('🔍 Checking order ID mismatch between CSV files and database...');
    
    // Get sample order IDs from database
    console.log('\n📦 Sample order IDs from database:');
    const { data: dbOrders, error: dbError } = await supabase
      .from('orders')
      .select('order_id')
      .order('order_id', { ascending: true })
      .limit(20);
    
    if (dbError) {
      console.error('❌ Error fetching database orders:', dbError);
      return;
    }
    
    console.log('Database order IDs:', dbOrders.map(o => o.order_id).join(', '));
    
    // Check customer notes CSV
    console.log('\n📝 Checking Customer Notes CSV:');
    const notesPath = path.join(__dirname, 'migration/cleaned/Customer Notes.csv');
    if (fs.existsSync(notesPath)) {
      const csvContent = fs.readFileSync(notesPath, 'utf-8');
      const notesData = parse(csvContent, { columns: true });
      
      const csvOrderIds = [...new Set(notesData.map(note => note['Order #']))].slice(0, 20);
      console.log('CSV order IDs:', csvOrderIds.join(', '));
      
      // Check overlap
      const dbOrderIds = dbOrders.map(o => o.order_id);
      const overlap = csvOrderIds.filter(id => dbOrderIds.includes(id));
      console.log(`📊 Overlap: ${overlap.length}/${csvOrderIds.length} orders found in database`);
      console.log('Matching orders:', overlap.join(', '));
    }
    
    // Check diamonds CSV
    console.log('\n💎 Checking Diamonds CSV:');
    const diamondsPath = path.join(__dirname, 'migration/cleaned/Diamonds.csv');
    if (fs.existsSync(diamondsPath)) {
      const csvContent = fs.readFileSync(diamondsPath, 'utf-8');
      const diamondsData = parse(csvContent, { columns: true });
      
      const csvOrderIds = [...new Set(diamondsData.map(diamond => diamond['Order #']))].slice(0, 20);
      console.log('CSV order IDs:', csvOrderIds.join(', '));
      
      // Check overlap
      const dbOrderIds = dbOrders.map(o => o.order_id);
      const overlap = csvOrderIds.filter(id => dbOrderIds.includes(id));
      console.log(`📊 Overlap: ${overlap.length}/${csvOrderIds.length} orders found in database`);
      console.log('Matching orders:', overlap.join(', '));
    }
    
    // Check casting CSV
    console.log('\n🏭 Checking Casting CSV:');
    const castingPath = path.join(__dirname, 'migration/cleaned/casting.csv');
    if (fs.existsSync(castingPath)) {
      const csvContent = fs.readFileSync(castingPath, 'utf-8');
      const castingData = parse(csvContent, { columns: true });
      
      const csvOrderIds = [...new Set(castingData.map(casting => casting['Order #']))].slice(0, 20);
      console.log('CSV order IDs:', csvOrderIds.join(', '));
      
      // Check overlap
      const dbOrderIds = dbOrders.map(o => o.order_id);
      const overlap = csvOrderIds.filter(id => dbOrderIds.includes(id));
      console.log(`📊 Overlap: ${overlap.length}/${csvOrderIds.length} orders found in database`);
      console.log('Matching orders:', overlap.join(', '));
    }
    
    // Check 3D related CSV
    console.log('\n🎨 Checking 3D Related CSV:');
    const threeDPath = path.join(__dirname, 'migration/cleaned/3drelated.csv');
    if (fs.existsSync(threeDPath)) {
      const csvContent = fs.readFileSync(threeDPath, 'utf-8');
      const threeDData = parse(csvContent, { columns: true });
      
      const csvOrderIds = [...new Set(threeDData.map(item => item['Order #']))].slice(0, 20);
      console.log('CSV order IDs:', csvOrderIds.join(', '));
      
      // Check overlap
      const dbOrderIds = dbOrders.map(o => o.order_id);
      const overlap = csvOrderIds.filter(id => dbOrderIds.includes(id));
      console.log(`📊 Overlap: ${overlap.length}/${csvOrderIds.length} orders found in database`);
      console.log('Matching orders:', overlap.join(', '));
    }
    
    // Check employee comments CSV
    console.log('\n💬 Checking Employee Comments CSV:');
    const commentsPath = path.join(__dirname, 'migration/cleaned/Employee Comments.xlsx');
    if (fs.existsSync(commentsPath)) {
      console.log('✅ Employee Comments file exists (Excel format)');
      // Note: We can't easily parse Excel here, but we know it worked
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkOrderMismatch();
