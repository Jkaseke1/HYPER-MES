// test-conn.js - Verify Sage + Supabase connectivity before running the worker
const { sql, sageConfig, supabase } = require('./lib/db');

async function testConnections() {
  console.log('==============================================');
  console.log(' HYPER MES Bridge — Connection Test');
  console.log('==============================================\n');

  // Test Sage Pastel (MSSQL)
  try {
    console.log('Testing Sage Pastel connection...');
    const pool = await sql.connect(sageConfig);
    const result = await pool.request()
      .query(`SELECT TOP 3 Code, Description_1 FROM StkItem WHERE ItemActive = 1 AND Code != 'Service Item'`);
    console.log('✅ Sage connected successfully');
    console.log('   Sample stock items:');
    result.recordset.forEach(r => console.log(`   - ${r.Code}: ${r.Description_1}`));
    await sql.close();
  } catch (err) {
    console.error('❌ Sage connection failed:', err.message);
  }

  console.log('');

  // Test Supabase
  try {
    console.log('Testing Supabase connection...');
    const { data, error } = await supabase
      .from('raw_materials')
      .select('name, sage_code')
      .limit(3);
    if (error) throw error;
    console.log('✅ Supabase connected successfully');
    console.log('   Sample raw materials:');
    data.forEach(r => console.log(`   - ${r.name} (${r.sage_code})`));
  } catch (err) {
    console.error('❌ Supabase connection failed:', err.message);
  }

  console.log('\n==============================================');
  console.log(' Connection test complete');
  console.log('==============================================');
}

testConnections().then(() => process.exit(0));
