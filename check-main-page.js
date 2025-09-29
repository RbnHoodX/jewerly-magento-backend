const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function checkMainPage() {
  try {
    console.log('🔍 Checking main_page.csv file...');
    
    const mainPagePath = path.join(__dirname, 'migration/cleaned/main_page.csv');
    
    if (!fs.existsSync(mainPagePath)) {
      console.log('❌ main_page.csv not found');
      return;
    }
    
    console.log('✅ main_page.csv found');
    
    // Read the file
    const csvContent = fs.readFileSync(mainPagePath, 'utf-8');
    const mainPageData = parse(csvContent, { columns: true });
    
    console.log(`📊 Found ${mainPageData.length} records in main_page.csv`);
    
    // Show first few records
    console.log('\n📋 First 5 records:');
    mainPageData.slice(0, 5).forEach((record, index) => {
      console.log(`  ${index + 1}. Order #: ${record['Order #']}, Customer: ${record['Customer Name'] || 'N/A'}`);
    });
    
    // Get unique order numbers
    const orderNumbers = [...new Set(mainPageData.map(record => record['Order #']))];
    console.log(`\n📊 Unique order numbers: ${orderNumbers.length}`);
    console.log('First 20 order numbers:', orderNumbers.slice(0, 20).join(', '));
    
    // Check if these match the related data
    console.log('\n🔍 Checking overlap with related data...');
    
    // Check against customer notes
    const notesPath = path.join(__dirname, 'migration/cleaned/Customer Notes.csv');
    if (fs.existsSync(notesPath)) {
      const notesContent = fs.readFileSync(notesPath, 'utf-8');
      const notesData = parse(notesContent, { columns: true });
      const notesOrderNumbers = [...new Set(notesData.map(note => note['Order #']))];
      
      const overlap = orderNumbers.filter(id => notesOrderNumbers.includes(id));
      console.log(`📝 Customer Notes overlap: ${overlap.length}/${notesOrderNumbers.length} orders match`);
      if (overlap.length > 0) {
        console.log('Matching orders:', overlap.slice(0, 10).join(', '));
      }
    }
    
    // Check against diamonds
    const diamondsPath = path.join(__dirname, 'migration/cleaned/Diamonds.csv');
    if (fs.existsSync(diamondsPath)) {
      const diamondsContent = fs.readFileSync(diamondsPath, 'utf-8');
      const diamondsData = parse(diamondsContent, { columns: true });
      const diamondsOrderNumbers = [...new Set(diamondsData.map(diamond => diamond['Order #']))];
      
      const overlap = orderNumbers.filter(id => diamondsOrderNumbers.includes(id));
      console.log(`💎 Diamonds overlap: ${overlap.length}/${diamondsOrderNumbers.length} orders match`);
      if (overlap.length > 0) {
        console.log('Matching orders:', overlap.slice(0, 10).join(', '));
      }
    }
    
    // Check against casting
    const castingPath = path.join(__dirname, 'migration/cleaned/casting.csv');
    if (fs.existsSync(castingPath)) {
      const castingContent = fs.readFileSync(castingPath, 'utf-8');
      const castingData = parse(castingContent, { columns: true });
      const castingOrderNumbers = [...new Set(castingData.map(casting => casting['Order #']))];
      
      const overlap = orderNumbers.filter(id => castingOrderNumbers.includes(id));
      console.log(`🏭 Casting overlap: ${overlap.length}/${castingOrderNumbers.length} orders match`);
      if (overlap.length > 0) {
        console.log('Matching orders:', overlap.slice(0, 10).join(', '));
      }
    }
    
    // Check against 3D related
    const threeDPath = path.join(__dirname, 'migration/cleaned/3drelated.csv');
    if (fs.existsSync(threeDPath)) {
      const threeDContent = fs.readFileSync(threeDPath, 'utf-8');
      const threeDData = parse(threeDContent, { columns: true });
      const threeDOrderNumbers = [...new Set(threeDData.map(item => item['Order #']))];
      
      const overlap = orderNumbers.filter(id => threeDOrderNumbers.includes(id));
      console.log(`🎨 3D Related overlap: ${overlap.length}/${threeDOrderNumbers.length} orders match`);
      if (overlap.length > 0) {
        console.log('Matching orders:', overlap.slice(0, 10).join(', '));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkMainPage();
