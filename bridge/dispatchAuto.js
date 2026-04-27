// dispatchAuto.js - Event 4: Dispatch Delivery Handler
// Reads from dispatch_orders + dispatch_items by reference_id from sync_log
// Posts to Sage Pastel via direct MSSQL: two-leg transfer (DSP WhseID=20 → branch whse)

const { sql, sageConfig, supabase, safeWrite } = require('./lib/db');

const BRANCH_WAREHOUSE_MAP = {
  'GLE0002': 36, 'MAR0001': 8,  'MAS0001': 9,  'BUL0001': 3,
  'DAN0002': 32, 'SHO0001': 11, 'KAG0001': 5,  'MAK0001': 7,
  'MBU0001': 23, 'MAZ00001': 28,'EPW0001': 27, 'HAT0001': 35,
  'CHK0001': 40, 'MAINDOM0002': 38, 'DOM0002': 37, 'NGE0001': 10,
  'GWE0001': 44, 'MTR0002': 21, 'CHR0002': 43, 'FCS0001': 26,
  'AMT0002': 2,  'MSA0002': 31, 'SOU0001': 41, 'ZVI0001': 24,
  'CHI000001': 39,
};

async function handleDispatch(syncEvent) {
  console.log('\n  → Event 4: Dispatch (Auto)');

  const dispatchId = syncEvent.reference_id;

  const { data: dispatch, error } = await supabase
    .from('dispatch_orders')
    .select(`
      id, dispatch_number, dispatch_date, status,
      branches ( id, name, sage_code )
    `)
    .eq('id', dispatchId)
    .single();

  if (error || !dispatch) throw new Error(`Dispatch not found: ${dispatchId}`);

  const branchSageCode = dispatch.branches?.sage_code;
  const destWhseLink   = BRANCH_WAREHOUSE_MAP[branchSageCode];

  console.log(`  Dispatch: ${dispatch.dispatch_number}`);
  console.log(`  Branch: ${dispatch.branches?.name} (${branchSageCode})`);

  if (!destWhseLink) throw new Error(`No warehouse mapping for ${branchSageCode}`);

  const { data: items, error: itemsError } = await supabase
    .from('dispatch_items')
    .select(`
      id, quantity, unit_price,
      formulations ( id, name, sage_code )
    `)
    .eq('dispatch_order_id', dispatchId);

  if (itemsError || !items || items.length === 0) {
    throw new Error(`No items for dispatch ${dispatch.dispatch_number}`);
  }

  let pool;
  try {
    pool = await sql.connect(sageConfig);

    for (const item of items) {
      const sageCode = item.formulations?.sage_code;
      const qty      = Number(item.quantity);

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
      const reference   = dispatch.dispatch_number.substring(0, 20);
      const descOut     = `Dispatch to ${dispatch.branches?.name}`.substring(0, 40);
      const descIn      = `Receipt fr DSP ${dispatch.dispatch_number}`.substring(0, 40);

      console.log(`  Item: ${sageCode} — ${qty}kg to warehouse ${destWhseLink}`);

      await safeWrite(
        `Dispatch ${qty}kg of ${sageCode} to ${dispatch.branches?.name}`,
        async () => {
          // Issue from DSP (WhseID=20)
          await pool.request()
            .input('iInvJrBatchID', sql.Int,      1)
            .input('iStockID',      sql.Int,      stockLink)
            .input('iWarehouseID',  sql.Int,      20)
            .input('dTrDate',       sql.DateTime, new Date(dispatch.dispatch_date))
            .input('iTrCodeID',     sql.Int,      31)
            .input('iGLContraID',   sql.Int,      0)
            .input('cReference',    sql.VarChar,  reference)
            .input('cDescription',  sql.VarChar,  descOut)
            .input('fQtyIn',        sql.Float,    0)
            .input('fQtyOut',       sql.Float,    qty)
            .input('fNewCost',      sql.Float,    Number(item.unit_price || 0))
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

          await pool.request()
            .input('StockID', sql.Int,   stockLink)
            .input('WhseID',  sql.Int,   20)
            .input('QtyOut',  sql.Float, qty)
            .query(`UPDATE _etblStockQtys SET QtyOnHand = QtyOnHand - @QtyOut WHERE StockID = @StockID AND WhseID = @WhseID`);

          // Receive into branch warehouse
          await pool.request()
            .input('iInvJrBatchID', sql.Int,      1)
            .input('iStockID',      sql.Int,      stockLink)
            .input('iWarehouseID',  sql.Int,      destWhseLink)
            .input('dTrDate',       sql.DateTime, new Date(dispatch.dispatch_date))
            .input('iTrCodeID',     sql.Int,      31)
            .input('iGLContraID',   sql.Int,      0)
            .input('cReference',    sql.VarChar,  reference)
            .input('cDescription',  sql.VarChar,  descIn)
            .input('fQtyIn',        sql.Float,    qty)
            .input('fQtyOut',       sql.Float,    0)
            .input('fNewCost',      sql.Float,    Number(item.unit_price || 0))
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

          const branchQty = await pool.request()
            .input('StockID', sql.Int, stockLink)
            .input('WhseID',  sql.Int, destWhseLink)
            .query(`SELECT idStockQtys FROM _etblStockQtys WHERE StockID = @StockID AND WhseID = @WhseID`);

          if (branchQty.recordset.length > 0) {
            await pool.request()
              .input('StockID', sql.Int,   stockLink)
              .input('WhseID',  sql.Int,   destWhseLink)
              .input('QtyIn',   sql.Float, qty)
              .query(`UPDATE _etblStockQtys SET QtyOnHand = QtyOnHand + @QtyIn WHERE StockID = @StockID AND WhseID = @WhseID`);
          } else {
            await pool.request()
              .input('StockID', sql.Int,   stockLink)
              .input('WhseID',  sql.Int,   destWhseLink)
              .input('QtyIn',   sql.Float, qty)
              .query(`INSERT INTO _etblStockQtys (StockID, WhseID, QtyOnHand) VALUES (@StockID, @WhseID, @QtyIn)`);
          }
        }
      );
    }
  } finally {
    if (pool) await sql.close();
  }
}

module.exports = { handleDispatch };

if (require.main === module) {
  handleDispatch({ reference_id: process.argv[2] })
    .then(() => { console.log('✅ Done'); process.exit(0); })
    .catch((err) => { console.error('❌', err.message); process.exit(1); });
}
