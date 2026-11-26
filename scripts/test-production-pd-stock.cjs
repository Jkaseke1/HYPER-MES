const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'pd-stock-test-'));
try {
  esbuild.buildSync({entryPoints:['src/lib/productionPdStock.ts'],outfile:path.join(dir,'stock.cjs'),platform:'node',format:'cjs'});
  const { formatPdAvailability, freshPdQuantity, pdStockProblems } = require(path.join(dir,'stock.cjs'));
  assert.equal(formatPdAvailability(null, 'kg'), 'Sage PD balance unavailable or stale');
  assert.equal(formatPdAvailability(0, 'kg'), 'have 0 kg');
  const now = Date.parse('2026-11-24T12:00:00Z'), date = new Date(now-1000).toISOString();
  assert.equal(freshPdQuantity(0,date,2,now),0);
  for(const value of [null,undefined,'',NaN,Infinity,-1]) assert.equal(freshPdQuantity(value,date,2,now),null);
  for(const value of [null,'bad','2026-11-24T13:00:00Z','2026-11-23T12:00:00Z']) assert.equal(freshPdQuantity(10,value,2,now),null);
  const line={raw_material_id:'a',planned_qty:6,issued:false,unit:'kg'};
  assert.equal(pdStockProblems([line],{a:6},{a:date},2,now).length,0);
  assert.equal(pdStockProblems([line,line],{a:10},{a:date},2,now).length,1);
  assert.equal(pdStockProblems([line],{a:0},{a:date},2,now).length,1);
  assert.equal(pdStockProblems([line],{}, {},2,now).length,1);
  assert.equal(pdStockProblems([{...line,planned_qty:NaN}],{a:10},{a:date},2,now).length,1);
  assert.equal(pdStockProblems([line,{...line,unit:'bags'}],{a:20},{a:date},2,now).length,1);
  assert.equal(pdStockProblems([{...line,issued:true}],{}, {},2,now).length,0);
  console.log('PASS: PD zero, missing/stale/future/nonfinite stock, grouped BOM demand, units, and issued lines');
} finally { fs.rmSync(dir,{recursive:true,force:true}); }
