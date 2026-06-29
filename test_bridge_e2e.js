// test_bridge_e2e.js - Quick verification script for bridge handlers
// Run this after making changes to verify syntax

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'bridge', '.env') });

console.log('Testing bridge module imports...\n');

try {
  const { handleGoodsReceipt } = require('./bridge/goodsReceiptAuto');
  console.log('✅ goodsReceiptAuto.js imports OK');
} catch (err) {
  console.error('❌ goodsReceiptAuto.js import failed:', err.message);
}

try {
  const { handleGoodsIssue } = require('./bridge/goodsIssueAuto');
  console.log('✅ goodsIssueAuto.js imports OK');
} catch (err) {
  console.error('❌ goodsIssueAuto.js import failed:', err.message);
}

try {
  const { handleBatchComplete } = require('./bridge/batchCompleteAuto');
  console.log('✅ batchCompleteAuto.js imports OK');
} catch (err) {
  console.error('❌ batchCompleteAuto.js import failed:', err.message);
}

try {
  const { handleDispatch } = require('./bridge/dispatchAuto');
  console.log('✅ dispatchAuto.js imports OK');
} catch (err) {
  console.error('❌ dispatchAuto.js import failed:', err.message);
}

try {
  const { bridgeWorker } = require('./bridge/bridgeWorker');
  console.log('✅ bridgeWorker.js imports OK');
} catch (err) {
  console.error('❌ bridgeWorker.js import failed:', err.message);
}

console.log('\nAll imports completed. Check for errors above.');
console.log('Note: HYPER MES\\bridge\\ is older version. Active bridge is in hyper-integration\\events\\');
