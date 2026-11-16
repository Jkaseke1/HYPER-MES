const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
async function run(price) {
  const writes = [];
  const db = { from(table) {
    const q = { select() { return q; }, eq() { return q; }, order() { return q; }, in() { return q; },
      async upsert(row) { writes.push(row); return { error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: table === 'packaging_skus'
        ? [{ sage_stock_code: 'PASG0050' }] : [], error: null }).then(resolve, reject); } };
    return q;
  } };
  const transport = { request(options, callback) {
    assert.match(options.path, /itemCode=PASG0050&warehouse=PD/);
    const req = new EventEmitter();
    req.end = () => {
      const response = new EventEmitter();
      response.statusCode = 200; response.setEncoding = () => {};
      callback(response);
      response.emit('data', JSON.stringify({ quantity: 100, averageUnitCost: price }));
      response.emit('end');
    };
    return req;
  } };
  const context = { module: { exports: {} }, process: { env: { SAGE_SDK_API_KEY: 'test' } },
    URL, Date, console, require(name) { return name === './lib/db' ? { supabase: db } : transport; } };
  vm.runInNewContext(fs.readFileSync('bridge/sageStockSync.js', 'utf8'), context);
  const result = await context.module.exports.syncSageStock(['PASG0050'], { warehouseCodes: ['PD'] });
  assert.equal(result.failures.length, 0);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].raw_material_id, null, 'Packaging need not exist in the ingredient catalogue');
  assert.equal(writes[0].quantity, 100);
  return writes[0];
}
(async () => {
  const costed = await run(0.32);
  assert.equal(costed.average_unit_cost, 0.32);
  assert.ok(costed.cost_synced_at);
  const missing = await run(undefined);
  assert.equal(missing.average_unit_cost, null, 'Missing price must remain unknown');
  assert.equal(missing.cost_synced_at, null);
  console.log('PASS: packaging-only mapping, PD unit cost cache and missing-cost handling. No database calls.');
})().catch(error => { console.error(error); process.exitCode = 1; });
