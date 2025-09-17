#!/usr/bin/env node

// Simple test script to verify the server is working
const http = require('http');

const testServer = () => {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/health',
    method: 'GET',
    timeout: 5000
  };

  console.log('🧪 Testing server health endpoint...');
  
  const req = http.request(options, (res) => {
    console.log(`✅ Server responded with status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('📄 Response body:', data);
      console.log('✅ Server is working correctly!');
      process.exit(0);
    });
  });

  req.on('error', (err) => {
    console.error('❌ Server test failed:', err.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('❌ Server test timed out');
    req.destroy();
    process.exit(1);
  });

  req.end();
};

// Wait a moment for server to start, then test
setTimeout(testServer, 2000);
