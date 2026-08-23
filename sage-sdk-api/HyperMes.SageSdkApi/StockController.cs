using Pastel.Evolution;
using System;
using System.Net;
using System.Web.Http;

namespace SDK_Test
{
    [RoutePrefix("api/v1/stock")]
    public class StockController : ApiController
    {
        // Read-only SDK endpoint used by the MES bridge to maintain its Sage stock cache.
        [HttpGet]
        [Route("{itemCode}")]
        public IHttpActionResult GetWarehouseStock(string itemCode, [FromUri] string warehouse)
        {
            if (string.IsNullOrWhiteSpace(itemCode))
                return BadRequest("Item code is required.");
            if (string.IsNullOrWhiteSpace(warehouse))
                return BadRequest("Warehouse is required.");

            try
            {
                SdkSession.EnsureConnected();

                var item = new InventoryItem(itemCode.Trim().ToUpperInvariant());
                var sageWarehouse = new Warehouse(warehouse.Trim().ToUpperInvariant());
                var context = item.WarehouseContexts[sageWarehouse];
                if (context == null)
                {
                    return Content(HttpStatusCode.NotFound, new
                    {
                        status = "not-found",
                        message = "Sage has no warehouse context for " + item.Code + " in " + sageWarehouse.Code + "."
                    });
                }

                return Ok(new
                {
                    status = "ok",
                    environment = "UAT",
                    itemCode = item.Code,
                    warehouse = sageWarehouse.Code,
                    quantity = context.QtyOnHand,
                    averageUnitCost = context.AverageUnitCost,
                    readAtUtc = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.BadRequest, new
                {
                    status = "failed",
                    message = "Sage stock lookup failed.",
                    exceptionMessage = ex.Message
                });
            }
        }
    }
}
