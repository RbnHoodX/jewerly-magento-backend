const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRelatedDataImport() {
  try {
    console.log('🔍 Testing related data import manually...');
    
    // Test Customer Notes (using order_costs)
    console.log('\n📝 Testing Customer Notes import...');
    const notesPath = path.join(__dirname, 'migration/cleaned/Customer Notes.csv');
    if (fs.existsSync(notesPath)) {
      const csvContent = fs.readFileSync(notesPath, 'utf-8');
      const notesData = parse(csvContent, { columns: true });
      
      console.log(`📝 Found ${notesData.length} customer notes`);
      
      // Get first 5 notes for testing
      const testNotes = notesData.slice(0, 5);
      console.log('📝 Testing with first 5 notes:');
      testNotes.forEach((note, index) => {
        console.log(`  ${index + 1}. Order #: ${note['Order #']}, Comment: ${note['Comment']?.substring(0, 50)}...`);
      });
      
      // Check if these orders exist
      const orderNumbers = [...new Set(testNotes.map(note => note['Order #']))];
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id')
        .in('order_id', orderNumbers);
      
      if (orderError) {
        console.error('❌ Error fetching orders:', orderError);
      } else {
        console.log(`📦 Found ${orders.length} matching orders in database`);
        orders.forEach(order => {
          console.log(`  - Order ID: ${order.order_id}, Database ID: ${order.id}`);
        });
        
        if (orders.length > 0) {
          // Try to insert a test record
          const orderMap = new Map();
          orders.forEach(order => {
            orderMap.set(order.order_id, order.id);
          });
          
          const testInsert = {
            order_id: orderMap.get(testNotes[0]['Order #']),
            casting: 0,
            diamond: 0,
            labor: 0,
          };
          
          console.log('📝 Attempting to insert test record:', testInsert);
          
          const { data: insertData, error: insertError } = await supabase
            .from('order_costs')
            .insert([testInsert]);
          
          if (insertError) {
            console.error('❌ Error inserting test record:', insertError);
          } else {
            console.log('✅ Test record inserted successfully!');
            
            // Clean up
            await supabase
              .from('order_costs')
              .delete()
              .eq('order_id', testInsert.order_id);
            
            console.log('🧹 Test record cleaned up');
          }
        }
      }
    } else {
      console.log('❌ Customer Notes.csv not found');
    }
    
    // Test Diamonds (using diamond_deductions)
    console.log('\n💎 Testing Diamonds import...');
    const diamondsPath = path.join(__dirname, 'migration/cleaned/Diamonds.csv');
    if (fs.existsSync(diamondsPath)) {
      const csvContent = fs.readFileSync(diamondsPath, 'utf-8');
      const diamondsData = parse(csvContent, { columns: true });
      
      console.log(`💎 Found ${diamondsData.length} diamond records`);
      
      // Get first 5 diamonds for testing
      const testDiamonds = diamondsData.slice(0, 5);
      console.log('💎 Testing with first 5 diamonds:');
      testDiamonds.forEach((diamond, index) => {
        console.log(`  ${index + 1}. Order #: ${diamond['Order #']}, Carat Weight: ${diamond['Carat Weight']}`);
      });
      
      // Check if these orders exist
      const orderNumbers = [...new Set(testDiamonds.map(diamond => diamond['Order #']))];
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_id')
        .in('order_id', orderNumbers);
      
      if (orderError) {
        console.error('❌ Error fetching orders:', orderError);
      } else {
        console.log(`📦 Found ${orders.length} matching orders in database`);
        
        if (orders.length > 0) {
          // Try to insert a test record
          const orderMap = new Map();
          orders.forEach(order => {
            orderMap.set(order.order_id, order.id);
          });
          
          const testInsert = {
            order_id: orderMap.get(testDiamonds[0]['Order #']),
            ct_weight: parseFloat(testDiamonds[0]['Carat Weight']) || 0,
            stones: testDiamonds[0]['Shape'] || 'Round',
            price_per_ct: parseFloat(testDiamonds[0]['Price']) || 0,
            total_price: parseFloat(testDiamonds[0]['Price']) || 0,
          };
          
          console.log('💎 Attempting to insert test record:', testInsert);
          
          const { data: insertData, error: insertError } = await supabase
            .from('diamond_deductions')
            .insert([testInsert]);
          
          if (insertError) {
            console.error('❌ Error inserting test record:', insertError);
          } else {
            console.log('✅ Test record inserted successfully!');
            
            // Clean up
            await supabase
              .from('diamond_deductions')
              .delete()
              .eq('order_id', testInsert.order_id);
            
            console.log('🧹 Test record cleaned up');
          }
        }
      }
    } else {
      console.log('❌ Diamonds.csv not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testRelatedDataImport();
