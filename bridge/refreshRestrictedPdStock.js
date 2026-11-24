const { syncRestrictedPdStock } = require('./sageStockSync');

syncRestrictedPdStock(process.argv.slice(2))
  .then(({ synced }) => console.log(`Published ${synced} verified PD balances to Plant Control UAT.`))
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
