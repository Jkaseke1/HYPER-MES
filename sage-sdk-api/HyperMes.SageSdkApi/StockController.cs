using Pastel.Evolution;
using System;
using System.Net;
using System.Data.SqlClient;
using System.Web.Http;

namespace SDK_Test
{
    [RoutePrefix("api/v1/stock")]
    public class StockController : ApiController
    {
        // Read-only SDK endpoint used by the MES bridge to maintain its Sage stock cache.
        [HttpGet]
        [Route("")]
        public IHttpActionResult GetWarehouseStock([FromUri] string itemCode, [FromUri] string warehouse)
        {
            if (string.IsNullOrWhiteSpace(itemCode))
                return BadRequest("Item code is required.");
            if (string.IsNullOrWhiteSpace(warehouse))
                return BadRequest("Warehouse is required.");

            try
            {
                lock (SdkSession.OperationLock)
                {
                    return Ok(ReadStock(itemCode, warehouse));
                }
            }
            catch (Exception ex)
            {
                try
                {
                    // A stale SDK context is recoverable. Retry once before
                    // reporting an invalid item or warehouse to the bridge.
                    lock (SdkSession.OperationLock)
                    {
                        SdkSession.Reconnect();
                        return Ok(ReadStock(itemCode, warehouse));
                    }
                }
                catch (Exception retryException)
                {
                    return Content(HttpStatusCode.BadRequest, new
                    {
                        status = "failed",
                        message = "Sage stock lookup failed.",
                        exceptionMessage = retryException.Message,
                        initialExceptionMessage = ex.Message
                    });
                }
            }
        }

        private static object ReadStock(string itemCode, string warehouse)
        {
            SdkSession.EnsureConnected();

            var item = new InventoryItem(itemCode.Trim().ToUpperInvariant());
            var sageWarehouse = new Warehouse(warehouse.Trim().ToUpperInvariant());
            var context = item.WarehouseContexts[sageWarehouse];
            if (context == null)
                throw new InvalidOperationException("Sage has no warehouse context for " + item.Code + " in " + sageWarehouse.Code + ".");
            decimal manufacturingWip=0;
            bool manufacturingWipVerified = SageRuntime.EnvironmentName=="UAT" && SageRuntime.CompanyDatabase=="Hyperfeeds 2026 UAT"
                && Environment.GetEnvironmentVariable("HYPER_SAGE_NATIVE_BRIDGE_ENABLED")=="true";
            if(manufacturingWipVerified) {
                using(var command=new SqlCommand("SELECT COALESCE(SUM(QtyMFPWIP),0) FROM dbo._etblStockQtys WHERE StockID=@Stock AND WhseID=@Warehouse")) {
                    command.Parameters.AddWithValue("@Stock",item.ID);command.Parameters.AddWithValue("@Warehouse",sageWarehouse.ID);
                    manufacturingWip=Convert.ToDecimal(DatabaseContext.ExecuteCommandScalar(command));
                }
            }

            return new
            {
                status = "ok",
                environment = SageRuntime.EnvironmentName,
                companyDatabase = SageRuntime.CompanyDatabase,
                warehouseId = sageWarehouse.ID,
                manufacturingWipVerified,
                itemCode = item.Code,
                warehouse = sageWarehouse.Code,
                quantity = context.QtyOnHand,
                availableQuantity = (decimal)context.QtyFree - manufacturingWip,
                averageUnitCost = context.AverageUnitCost,
                readAtUtc = DateTime.UtcNow
            };
        }
    }
}
