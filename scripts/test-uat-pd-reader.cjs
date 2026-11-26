const assert = require('node:assert/strict');
const { validateStock, processOne } = require('../bridge/uatPdStockReader.cjs');

const now = Date.now();
const stock = {
  status: 'ok', environment: 'UAT', companyDatabase: 'Hyperfeeds UAT Bench 20261124',
  itemCode: 'MAW0001', warehouse: 'PD', warehouseId: 19, manufacturingWipVerified: true,
  availableQuantity: 0, readAtUtc: new Date(now).toISOString(),
};
assert.equal(validateStock(stock, 'MAW0001', now).available, 0);
for (const invalid of [
  { companyDatabase: 'Hyperfeeds 2026 UAT' }, { warehouseId: 18 }, { manufacturingWipVerified: false },
  { availableQuantity: null }, { availableQuantity: NaN }, { readAtUtc: new Date(now - 121000).toISOString() },
]) assert.throws(() => validateStock({ ...stock, ...invalid }, 'MAW0001', now));

async function run(failStock) {
  const updates = [], publications = [];
  const db = {
    from() {
      let update = null;
      const q = {
        select() { return q; }, eq() { return q; }, order() { return q; },
        limit() { return Promise.resolve({ data: [{ id: 'one', item_codes: ['MAW0001'] }], error: null }); },
        update(value) { update = value; updates.push(value); return q; },
        maybeSingle() { return Promise.resolve({ data: update?.status === 'failed'
          ? { status: 'failed' } : { id: 'one', item_codes: ['MAW0001'] }, error: null }); },
        then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
      };
      return q;
    },
    rpc(name, args) { publications.push({ name, args }); return Promise.resolve({ error: null }); },
  };
  await processOne(db, 'test', async url => url.endsWith('/health')
    ? { environment: 'UAT', companyDatabase: stock.companyDatabase, writeMode: 'Disabled' }
    : { ...stock, readAtUtc: new Date().toISOString(), manufacturingWipVerified: !failStock });
  return { updates, publications };
}
(async () => {
  const good = await run(false);
  assert.equal(good.publications.length, 1);
  assert.equal(good.publications[0].args.p_reads[0].code, 'MAW0001');
  const failed = await run(true);
  assert.equal(failed.publications.length, 0);
  assert.equal(failed.updates.at(-1).status, 'failed');
  console.log('PASS: restricted PD identity, WIP verification, freshness, zero and failed reads');
})().catch(error => { console.error(error); process.exitCode = 1; });
