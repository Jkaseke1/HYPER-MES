// Read-only Sage stock cache synchronizer. Sage remains the inventory authority.

const http = require('http');
const https = require('https');
const { supabase } = require('./lib/db');

const SDK_BASE_URL = (process.env.SAGE_SDK_API_BASE_URL || 'http://127.0.0.1:5088').replace(/\/+$/, '');
const SDK_API_KEY = process.env.SAGE_SDK_API_KEY || process.env.HYPER_SAGE_API_KEY;
const WAREHOUSES = [
  { code: 'RM', id: 18 },
  { code: 'PD', id: 19 },
];
const FULL_SYNC_BATCH_SIZE = Math.max(1, Number(process.env.SAGE_STOCK_SYNC_BATCH_SIZE || 25));
let nextFullSyncOffset = 0;

function getJson(urlString) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request({
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      headers: { 'X-Hyper-Api-Key': SDK_API_KEY },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        let parsed = {};
        try { parsed = body ? JSON.parse(body) : {}; } catch (_) { parsed = { message: body }; }
        if (response.statusCode >= 200 && response.statusCode < 300) return resolve(parsed);
        reject(new Error(parsed.message || parsed.Message || `HTTP ${response.statusCode}`));
      });
    });
    request.on('error', (error) => reject(error));
    request.end();
  });
}

async function loadMaterials(itemCodes) {
  let query = supabase
    .from('raw_materials')
    .select('id, code, sage_code')
    .eq('is_active', true)
    .order('id');
  if (itemCodes?.length) {
    query = query.in('sage_code', itemCodes);
  } else {
    query = query.range(nextFullSyncOffset, nextFullSyncOffset + FULL_SYNC_BATCH_SIZE - 1);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load MES raw materials: ${error.message}`);
  if (!itemCodes?.length) {
    nextFullSyncOffset = (data || []).length < FULL_SYNC_BATCH_SIZE
      ? 0
      : nextFullSyncOffset + FULL_SYNC_BATCH_SIZE;
  }
  return (data || []).filter((material) => (material.sage_code || material.code || '').trim());
}

async function syncSageStock(itemCodes) {
  if (!SDK_API_KEY) throw new Error('Missing SAGE_SDK_API_KEY or HYPER_SAGE_API_KEY for Sage stock sync');
  const materials = await loadMaterials(itemCodes);
  let synced = 0;
  const failures = [];

  for (const material of materials) {
    const itemCode = (material.sage_code || material.code).trim().toUpperCase();
    for (const warehouse of WAREHOUSES) {
      try {
        const stock = await getJson(`${SDK_BASE_URL}/api/v1/stock/${encodeURIComponent(itemCode)}?warehouse=${encodeURIComponent(warehouse.code)}`);
        const { error } = await supabase.from('sage_stock_balances').upsert({
          raw_material_id: material.id,
          sage_code: itemCode,
          warehouse_id: warehouse.id,
          quantity: Number(stock.quantity || 0),
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sage_code,warehouse_id' });
        if (error) throw new Error(error.message);
        synced += 1;
      } catch (error) {
        failures.push(`${itemCode}/${warehouse.code}: ${error.message}`);
      }
    }
  }

  return { materialCount: materials.length, synced, failures, fullSyncBatch: !itemCodes?.length };
}

module.exports = { syncSageStock };
