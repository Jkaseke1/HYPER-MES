const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const state = { event: null, updates: [], duplicateChecks: 0, reads: 0, posts: 0, fail: false, scope: [] };
const db = { from() {
  let update;
  let duplicate = false;
  const q = {
    select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; },
    in(key, values) { state.scope = values; return q; },
    neq() { duplicate = true; return q; },
    update(value) { update = value; return q; },
    async maybeSingle() { return { data: { id: state.event.id }, error: null }; },
    then(resolve, reject) {
      if (duplicate) state.duplicateChecks++;
      if (update) state.updates.push(update);
      const data = update ? null : duplicate ? [{ id: 'old-success' }] : [state.event];
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    },
  };
  return q;
} };
const context = { module: { exports: {} }, console: { log() {}, warn() {}, error() {} },
  process: { env: { BRIDGE_ALLOWED_EVENT_TYPES: 'materials_issued' }, on() {} }, Date, URL,
  require(name) {
    if (name === './lib/db') return { supabase: db, DRY_RUN: false };
    if (name === './sageStockSync') return {
      async syncSageStock(codes, options) {
        state.reads++;
        assert.equal(codes[0], 'PASG0050');
        assert.equal(options.warehouseCodes[0], 'PD');
        return { materialCount: 1, synced: state.fail ? 0 : 1, failures: state.fail ? ['SDK offline'] : [] };
      },
    };
    return new Proxy({}, { get: () => async () => { state.posts++; } });
  },
};
const source = fs.readFileSync('bridge/bridgeWorker.js', 'utf8')
  .replace(/startWorker\(\);\s*$/, 'module.exports = { processPendingEvents };');
vm.runInNewContext(source, context);
(async () => {
  for (const id of ['read-one', 'read-two']) {
    state.event = { id, event_type: 'sage_stock_refresh', reference_id: 'same-order',
      details: { itemCodes: ['PASG0050'], warehouseCodes: ['PD'] } };
    await context.module.exports.processPendingEvents();
  }
  assert.equal(state.reads, 2, 'Each separately claimed refresh must read Sage again');
  assert.equal(state.duplicateChecks, 0, 'Previous success must not suppress a fresh read');
  assert.ok(state.scope.includes('sage_stock_refresh'), 'Read refresh survives a posting allowlist');
  state.event = { id: 'duplicate-write', event_type: 'materials_issued', reference_id: 'same-order' };
  await context.module.exports.processPendingEvents();
  assert.equal(state.duplicateChecks, 1);
  assert.equal(state.posts, 0, 'Duplicate stock posting must still be blocked');
  assert.ok(state.updates.some(update => update.message?.startsWith('Duplicate')));
  state.fail = true;
  state.event = { id: 'failed-read', event_type: 'sage_stock_refresh', reference_id: 'same-order',
    details: { itemCodes: ['PASG0050'], warehouseCodes: ['PD'] } };
  await context.module.exports.processPendingEvents();
  assert.equal(state.updates.at(-1).status, 'failed', 'Incomplete reads must not be marked successful');
  console.log('PASS: repeated refresh reads, posting deduplication, read allowlist and failed refresh reporting. No database calls.');
})().catch(error => { console.error(error); process.exitCode = 1; });
