const { createClient } = require('@supabase/supabase-js');

const COMPANY = 'Hyperfeeds UAT Bench 20261124';
const PROJECT = 'https://appyuqxetlphuxfybmus.supabase.co';
const SDK = 'http://127.0.0.1:5089';

function validateStock(stock, code, now = Date.now()) {
  const observed = Date.parse(stock.readAtUtc);
  if (stock.status !== 'ok' || stock.environment !== 'UAT' || stock.companyDatabase !== COMPANY ||
      stock.itemCode !== code || stock.warehouse !== 'PD' || stock.warehouseId !== 19 ||
      stock.manufacturingWipVerified !== true || typeof stock.availableQuantity !== 'number' ||
      !Number.isFinite(stock.availableQuantity) || !Number.isFinite(observed) ||
      observed > now + 100 || now - observed > 120000) {
    throw new Error(`Unverified Sage PD availability for ${code}`);
  }
  return { code, available: stock.availableQuantity, observedAt: new Date(Math.min(observed, now) - 1000).toISOString() };
}

async function readJson(url, apiKey) {
  const response = await fetch(url, { headers: { 'X-Hyper-Api-Key': apiKey }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Sage SDK returned HTTP ${response.status}`);
  return response.json();
}

async function processOne(db, apiKey, request = readJson) {
  const health = await request(`${SDK}/api/v1/health`, apiKey);
  if (health.environment !== 'UAT' || health.companyDatabase !== COMPANY || health.writeMode !== 'Disabled') {
    throw new Error('The restricted UAT SDK is unavailable or writes are not disabled');
  }
  const { data: pending, error } = await db.from('uat_pd_stock_requests')
    .select('id,item_codes').eq('status', 'pending').order('created_at').limit(1);
  if (error) throw new Error(`Could not read PD stock queue: ${error.message}`);
  if (!pending.length) return false;
  const { data: claimed, error: claimError } = await db.from('uat_pd_stock_requests')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', pending[0].id).eq('status', 'pending').select('id,item_codes').maybeSingle();
  if (claimError) throw new Error(`Could not claim PD stock request: ${claimError.message}`);
  if (!claimed) return false;
  try {
    if (!Array.isArray(claimed.item_codes) || claimed.item_codes.length < 1 || claimed.item_codes.length > 40 ||
        new Set(claimed.item_codes).size !== claimed.item_codes.length ||
        claimed.item_codes.some(code => typeof code !== 'string' || !/^[A-Z0-9_-]+$/.test(code))) {
      throw new Error('Invalid item codes in PD stock request');
    }
    const reads = [];
    for (const code of claimed.item_codes) {
      const stock = await request(`${SDK}/api/v1/stock?warehouse=PD&itemCode=${encodeURIComponent(code)}`, apiKey);
      reads.push(validateStock(stock, code));
    }
    const { error: publishError } = await db.rpc('complete_uat_pd_stock', { p_request_id: claimed.id, p_reads: reads });
    if (publishError) throw new Error(`PD stock publication failed: ${publishError.message}`);
    console.log(`Refreshed ${reads.length} Sage PD balances for request ${claimed.id}`);
    return true;
  } catch (error) {
    const { data: marked, error: markError } = await db.from('uat_pd_stock_requests')
      .update({ status: 'failed', message: error.message, updated_at: new Date().toISOString() })
      .eq('id', claimed.id).eq('status', 'processing').select('status').maybeSingle();
    if (markError) throw new Error(`PD stock request failed and could not be marked failed: ${markError.message}; ${error.message}`);
    if (!marked) {
      const { data: status, error: statusError } = await db.from('uat_pd_stock_requests')
        .select('status').eq('id', claimed.id).maybeSingle();
      if (statusError || status?.status !== 'success') {
        throw new Error(`PD stock request outcome is uncertain; inspect ${claimed.id}: ${error.message}`);
      }
      console.log(`PD stock request ${claimed.id} completed despite a response error`);
      return true;
    }
    console.error(`PD stock request ${claimed.id} failed: ${error.message}`);
    return true;
  }
}

async function main() {
  const project = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.SAGE_SDK_API_KEY || process.env.HYPER_SAGE_API_KEY;
  if (!project || new URL(project).origin !== PROJECT || !serviceKey || !apiKey ||
      process.env.SAGE_SDK_API_BASE_URL !== SDK) {
    throw new Error('Stock-only reader requires the exact UAT project and loopback restricted SDK');
  }
  const db = createClient(project, serviceKey, { auth: { persistSession: false } });
  console.log('Stock-only UAT PD reader started. No manufacturing events are processed.');
  while (true) {
    await processOne(db, apiKey);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { validateStock, processOne };
