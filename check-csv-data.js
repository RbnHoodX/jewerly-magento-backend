const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

async function checkCSVData() {
  try {
    console.log('🔍 Checking CSV data to understand the issue...');
    
    // Check customer notes CSV
    const notesPath = path.join(__dirname, 'migration/cleaned/Customer Notes.csv');
    if (fs.existsSync(notesPath)) {
      const csvContent = fs.readFileSync(notesPath, 'utf-8');
      const notesData = parse(csvContent, { columns: true });
      
      console.log(`📝 Customer Notes CSV: ${notesData.length} records`);
      console.log('📝 Sample order IDs from customer notes:');
      const sampleOrderIds = [...new Set(notesData.slice(0, 10).map(note => note['Order #']))];
      sampleOrderIds.forEach(id => console.log(`  - ${id}`));
    }
    
    // Check diamonds CSV
    const diamondsPath = path.join(__dirname, 'migration/cleaned/Diamonds.csv');
    if (fs.existsSync(diamondsPath)) {
      const csvContent = fs.readFileSync(diamondsPath, 'utf-8');
      const diamondsData = parse(csvContent, { columns: true });
      
      console.log(`💎 Diamonds CSV: ${diamondsData.length} records`);
      console.log('💎 Sample order IDs from diamonds:');
      const sampleOrderIds = [...new Set(diamondsData.slice(0, 10).map(diamond => diamond['Order #']))];
      sampleOrderIds.forEach(id => console.log(`  - ${id}`));
    }
    
    // Check casting CSV
    const castingPath = path.join(__dirname, 'migration/cleaned/casting.csv');
    if (fs.existsSync(castingPath)) {
      const csvContent = fs.readFileSync(castingPath, 'utf-8');
      const castingData = parse(csvContent, { columns: true });
      
      console.log(`🏭 Casting CSV: ${castingData.length} records`);
      console.log('🏭 Sample order IDs from casting:');
      const sampleOrderIds = [...new Set(castingData.slice(0, 10).map(casting => casting['Order #']))];
      sampleOrderIds.forEach(id => console.log(`  - ${id}`));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCSVData();
