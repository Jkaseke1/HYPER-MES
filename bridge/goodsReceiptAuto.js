// goodsReceiptAuto.js - Event 1: GRN Confirmation Handler
// Reads from goods_received_notes + grn_items by reference_id from sync_log
// Posts to Sage Pastel via direct MSSQL: journal line + QtyOnHand + average cost

const { sql, sageConfig, supabase, DRY_RUN } = require('./lib/db');

async function handleGoodsReceipt(syncEvent) {
  console.log('\n  → Event 1: Goods Receipt (Auto)');

  const grnId = syncEvent.reference_id;
  console.log(`  GRN ID: ${grnId}`);

  const { data: grn, error: grnError } = await supabase
    .from('goods_received_notes')
    .select('id, grn_number, received_date, status, supplier_id')
    .eq('id', grnId)
    .single();

  if (grnError || !grn) {
    throw new Error(`GRN not found: ${grnId} — ${grnError?.message}`);
  }

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name, sage_code')
    .eq('id', grn.supplier_id)
    .single();

  console.log(`  GRN: ${grn.grn_number} — ${supplier?.name}`);

  const { data: items, error: itemsError } = await supabase
    .from('grn_items')
    .select('id, received_qty, unit_cost, raw_material_id')
    .eq('grn_id', grnId);

  console.log(`  Items: count=${items?.length} error=${itemsError?.message}`);

  if (itemsError) throw new Error(`Items query error: ${itemsError.message}`);
  if (!items || items.length === 0) throw new Error(`No items found for GRN: ${grn.grn_number}`);

  for (const item of items) {
    const { data: rm } = await supabase
      .from('raw_materials')
      .select('id, name, sage_code')
      .eq('id', item.raw_material_id)
      .single();
    item.raw_materials = rm;
    console.log(`  RM: ${item.raw_material_id} → ${rm?.name} (${rm?.sage_code})`);
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would write ${items.length} GRN line(s) to Sage`);
    return;
  }

  const pool = await sql.connect(sageConfig);

  try {
    for (const item of items) {
      const sageCode = item.raw_materials?.sage_code;
      const rmName   = item.raw_materials?.name;

      if (!sageCode) {
        console.log(`  ⚠️  No sage_code for item — skipping`);
        continue;
      }

      const stockResult = await pool.request()
        .input('Code', sql.VarChar, sageCode)
        .query(`SELECT StockLink FROM StkItem WHERE Code = @Code AND ItemActive = 1`);

      if (stockResult.recordset.length === 0) {
        console.log(`  ⚠️  ${sageCode} not found in Sage — skipping`);
        continue;
      }

      const stockLink   = stockResult.recordset[0].StockLink;
      const reference   = grn.grn_number.substring(0, 20);
      const description = (rmName || sageCode).substring(0, 40);
      const qty         = Number(item.received_qty);
      const cost        = Number(item.unit_cost || 0);

      console.log(`  Processing: ${sageCode} — ${qty}kg @ $${cost}`);

      // STEP A — Write journal line
      await pool.request()
        .input('iInvJrBatchID', sql.Int,      2)
        .input('iStockID',      sql.Int,      stockLink)
        .input('iWarehouseID',  sql.Int,      18)
        .input('dTrDate',       sql.DateTime, new Date(grn.received_date))
        .input('iTrCodeID',     sql.Int,      31)
        .input('iGLContraID',   sql.Int,      0)
        .input('cReference',    sql.VarChar,  reference)
        .input('cDescription',  sql.VarChar,  description)
        .input('fQtyIn',        sql.Float,    qty)
        .input('fQtyOut',       sql.Float,    0)
        .input('fNewCost',      sql.Float,    cost)
        .input('bIsLotItem',    sql.Bit,      0)
        .input('bIsSerialItem', sql.Bit,      0)
        .query(`
          INSERT INTO _etblInvJrBatchLines (
            iInvJrBatchID, iStockID, iWarehouseID,
            dTrDate, iTrCodeID, iGLContraID,
            cReference, cDescription,
            fQtyIn, fQtyOut, fNewCost,
            bIsLotItem, bIsSerialItem
          ) VALUES (
            @iInvJrBatchID, @iStockID, @iWarehouseID,
            @dTrDate, @iTrCodeID, @iGLContraID,
            @cReference, @cDescription,
            @fQtyIn, @fQtyOut, @fNewCost,
            @bIsLotItem, @bIsSerialItem
          )
        `);

      console.log(`  ✅ Journal line written: ${sageCode} +${qty}kg`);

      // STEP B — Update QtyOnHand
      const existing = await pool.request()
        .input('StockID', sql.Int, stockLink)
        .input('WhseID',  sql.Int, 18)
        .query(`SELECT idStockQtys, QtyOnHand FROM _etblStockQtys WHERE StockID = @StockID AND WhseID = @WhseID`);

      if (existing.recordset.length > 0) {
        const before = existing.recordset[0].QtyOnHand;
        await pool.request()
          .input('StockID', sql.Int,   stockLink)
          .input('WhseID',  sql.Int,   18)
          .input('QtyIn',   sql.Float, qty)
          .query(`UPDATE _etblStockQtys SET QtyOnHand = QtyOnHand + @QtyIn WHERE StockID = @StockID AND WhseID = @WhseID`);
        console.log(`  ✅ QtyOnHand updated: ${before} → ${before + qty} (${sageCode} WhseID=18)`);
      } else {
        await pool.request()
          .input('StockID', sql.Int,   stockLink)
          .input('WhseID',  sql.Int,   18)
          .input('QtyIn',   sql.Float, qty)
          .query(`INSERT INTO _etblStockQtys (StockID, WhseID, QtyOnHand) VALUES (@StockID, @WhseID, @QtyIn)`);
        console.log(`  ✅ QtyOnHand inserted: ${qty} (${sageCode} WhseID=18 — new row)`);
      }

      // STEP C — Update average cost
      const whseResult = await pool.request()
        .input('StockLink', sql.Int, stockLink)
        .input('WhseID',    sql.Int, 18)
        .query(`SELECT IdWhseStk, fAverageCost FROM WhseStk WHERE WHStockLink = @StockLink AND WHWhseID = @WhseID`);

      if (whseResult.recordset.length > 0) {
        await pool.request()
          .input('StockLink', sql.Int,   stockLink)
          .input('WhseID',    sql.Int,   18)
          .input('NewCost',   sql.Float, cost)
          .query(`UPDATE WhseStk SET fAverageCost = @NewCost WHERE WHStockLink = @StockLink AND WHWhseID = @WhseID`);
        console.log(`  ✅ Average cost updated: ${sageCode} → $${cost}/kg (WhseStk)`);
      } else {
        console.log(`  ℹ️  No WhseStk row for ${sageCode} WhseID=18 — fAverageCost not set (non-critical)`);
      }
    }
  } finally {
    await sql.close();
    console.log(`  Connection closed.`);
  }
}

module.exports = { handleGoodsReceipt };

if (require.main === module) {
  handleGoodsReceipt({ reference_id: process.argv[2] })
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((err) => { console.error('❌', err.message); process.exit(1); });
}
