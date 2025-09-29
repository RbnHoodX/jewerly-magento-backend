const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCustomerNotesDebug() {
  try {
    console.log('🔍 Testing customer notes import with debug info...');
    
    // Read customer notes CSV
    const notesPath = path.join(__dirname, 'migration/cleaned/Customer Notes.csv');
    const csvContent = fs.readFileSync(notesPath, 'utf-8');
    const notesData = parse(csvContent, { columns: true });
    
    console.log(`📝 Found ${notesData.length} customer notes in CSV`);
    
    // Get first 10 notes for testing
    const testNotes = notesData.slice(0, 10);
    console.log('📝 Testing with first 10 notes:');
    testNotes.forEach((note, index) => {
      console.log(`  ${index + 1}. Order #: ${note['Order #']}, Comment: ${note['Comment']?.substring(0, 50)}...`);
    });
    
    // Get order numbers
    const orderNumbers = [...new Set(testNotes.map(note => note['Order #']))];
    console.log(`📝 Order numbers to check: ${orderNumbers.join(', ')}`);
    
    // Check if these orders exist
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, order_id')
      .in('order_id', orderNumbers);
    
    if (orderError) {
      console.error('❌ Error fetching orders:', orderError);
      return;
    }
    
    console.log(`📦 Found ${orders.length} matching orders in database:`);
    orders.forEach(order => {
      console.log(`  - Order ID: ${order.order_id}, Database ID: ${order.id}`);
    });
    
    // Create order map
    const orderMap = new Map();
    orders.forEach(order => {
      orderMap.set(order.order_id, order.id);
    });
    
    // Prepare note inserts
    const noteInserts = [];
    for (const noteData of testNotes) {
      if (orderMap.has(noteData['Order #'])) {
        const noteInsert = {
          order_id: orderMap.get(noteData['Order #']),
          content: noteData['Comment'] || 'No comment provided',
          is_important: false,
          created_by: null,
        };
        noteInserts.push(noteInsert);
        console.log(`✅ Prepared note for order ${noteData['Order #']}`);
      } else {
        console.log(`❌ Order ${noteData['Order #']} not found in database`);
      }
    }
    
    if (noteInserts.length > 0) {
      console.log(`📝 Attempting to insert ${noteInserts.length} customer notes...`);
      
      const { data, error } = await supabase
        .from('order_comments')
        .insert(noteInserts);
      
      if (error) {
        console.error('❌ Error inserting customer notes:', error);
      } else {
        console.log('✅ Customer notes inserted successfully!');
        console.log('📝 Inserted data:', data);
        
        // Check if they were actually inserted
        const { data: insertedNotes, error: checkError } = await supabase
          .from('order_comments')
          .select('*')
          .limit(5);
        
        if (checkError) {
          console.error('❌ Error checking inserted notes:', checkError);
        } else {
          console.log('📝 Current notes in database:', insertedNotes);
        }
      }
    } else {
      console.log('❌ No valid customer notes to insert');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCustomerNotesDebug();
