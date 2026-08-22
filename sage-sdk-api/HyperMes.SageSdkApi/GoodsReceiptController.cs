using Pastel.Evolution;
using System;
using System.Collections.Concurrent;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Net;
using System.Web.Http;

namespace SDK_Test
{
    [RoutePrefix("api/v1/goods-receipts")]
    public class GoodsReceiptController : ApiController
    {
        private static readonly ConcurrentDictionary<string, bool> PostedReferences =
            new ConcurrentDictionary<string, bool>(StringComparer.OrdinalIgnoreCase);

        [HttpPost]
        [Route("validate")]
        public IHttpActionResult ValidateGoodsReceipt(GoodsReceiptRequest request)
        {
            var error = ValidateRequest(request);
            if (error != null)
                return BadRequest(error);

            SdkSession.EnsureConnected();
            ValidateSageMasters(request);

            return Ok(new
            {
                status = "validated",
                environment = "UAT",
                action = "goods-receipt-grv",
                sageConnection = "verified",
                sagePosting = "not performed",
                message = "Validated against Sage UAT. No GRV was created.",
                goodsReceipt = GoodsReceiptSummary(request, null)
            });
        }

        [HttpPost]
        [Route("post")]
        public IHttpActionResult PostGoodsReceipt(GoodsReceiptRequest request)
        {
            var error = ValidateRequest(request);
            if (error != null)
                return BadRequest(error);

            if (!request.ConfirmPost)
            {
                return BadRequest(
                    "Posting is blocked. Set confirmPost to true only after approval.");
            }

            var reference = request.Reference.Trim();
            if (!PostedReferences.TryAdd(reference, true))
                return StatusCode(System.Net.HttpStatusCode.Conflict);

            try
            {
                SdkSession.EnsureConnected();
                ValidateSageMasters(request);

                var grvNumber = PostPurchaseOrderStock(request, GetNextSageGrvNumber());

                return Ok(new
                {
                    status = "posted",
                    environment = "UAT",
                    action = "goods-receipt-grv",
                    sagePosting = "completed",
                    grvNumber = grvNumber,
                    documentNumber = grvNumber,
                    message = "Goods receipt posted to Sage UAT as GRV.",
                    goodsReceipt = GoodsReceiptSummary(request, grvNumber)
                });
            }
            catch (Exception ex)
            {
                bool removed;
                PostedReferences.TryRemove(reference, out removed);

                return Content(HttpStatusCode.InternalServerError, new
                {
                    status = "failed",
                    environment = "UAT",
                    action = "goods-receipt-grv",
                    message = "Sage UAT could not post this goods receipt GRV.",
                    exception = ex.GetType().FullName,
                    exceptionMessage = ex.Message,
                    detail = ex.ToString()
                });
            }
        }

        private static string GetNextSageGrvNumber()
        {
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            using (var command = new SqlCommand(@"
                SELECT
                    COALESCE(
                        MAX(TRY_CONVERT(int, SUBSTRING(GrvValue, 6, 20))),
                        0
                    ) + 1
                FROM (
                    SELECT InvNumber AS GrvValue FROM InvNum WHERE InvNumber LIKE 'HFGRV[0-9]%'
                    UNION ALL
                    SELECT GrvNumber AS GrvValue FROM InvNum WHERE GrvNumber LIKE 'HFGRV[0-9]%'
                ) AS Numbers
                WHERE TRY_CONVERT(int, SUBSTRING(GrvValue, 6, 20)) IS NOT NULL;
            ", connection))
            {
                command.CommandTimeout = 60;
                connection.Open();
                var next = Convert.ToInt32(command.ExecuteScalar());
                return "HFGRV" + next.ToString("000000");
            }
        }

        private static string GetCompanyConnectionString()
        {
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = GetRequiredSetting("HYPER_SAGE_SERVER"),
                InitialCatalog = GetRequiredSetting("HYPER_SAGE_COMPANY_DATABASE"),
                UserID = GetRequiredSetting("HYPER_SAGE_SQL_USERNAME"),
                Password = GetRequiredSetting("HYPER_SAGE_SQL_PASSWORD"),
                ConnectTimeout = 30,
                TrustServerCertificate = true
            };

            return builder.ConnectionString;
        }

        private static string GetRequiredSetting(string name)
        {
            var value = Environment.GetEnvironmentVariable(name);
            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException("Missing Windows environment variable: " + name);
            return value;
        }

        private static string PostPurchaseOrderStock(GoodsReceiptRequest request, string grvNumber)
        {
            var txDate = request.ReceivedDate == default(DateTime)
                ? DateTime.Today
                : request.ReceivedDate.Date;

            var purchaseOrder = new PurchaseOrder
            {
                Supplier = new Supplier(request.SupplierCode.Trim()),
                OrderDate = txDate,
                InvoiceDate = txDate,
                DeliveryDate = txDate,
                DueDate = txDate,
                Description = "MES Goods Received Voucher",
                OrderNo = Trim(request.SupplierOrderNo, 50),
                ExternalOrderNo = Trim(FirstNonBlank(request.SupplierInvoiceNo, request.ExternalReference, request.Reference), 50),
                SupplierInvoiceNo = Trim(FirstNonBlank(request.SupplierInvoiceNo, request.Reference), 50),
                MessageLine1 = Trim("MES GRN " + request.Reference, 50),
                MessageLine2 = Trim(request.SupplierDeliveryNoteNo, 50),
                MessageLine3 = Trim(request.ExternalReference, 50),
                TaxMode = TaxMode.Exclusive
            };

            foreach (var line in request.Lines)
            {
                var item = new InventoryItem(line.ItemCode.Trim().ToUpperInvariant());
                var warehouseCode = FirstNonBlank(line.Warehouse, request.Warehouse, "RM")
                    .Trim()
                    .ToUpperInvariant();
                var detail = purchaseOrder.Detail.Add(
                    item,
                    warehouseCode,
                    (double)line.Quantity,
                    (double)line.UnitCost);

                detail.Warehouse = new Warehouse(warehouseCode);
                detail.Quantity = (double)line.Quantity;
                detail.ToProcess = (double)line.Quantity;
                detail.UnitCostPrice = (double)line.UnitCost;
                detail.Note = Trim(FirstNonBlank(line.LotNumber, request.Reference), 255);
            }

            return purchaseOrder.ProcessStock(grvNumber);
        }

        private static void ValidateSageMasters(GoodsReceiptRequest request)
        {
            new Supplier(request.SupplierCode.Trim());
            new Warehouse(FirstNonBlank(request.Warehouse, "RM").Trim().ToUpperInvariant());

            foreach (var line in request.Lines)
            {
                new InventoryItem(line.ItemCode.Trim().ToUpperInvariant());
                new Warehouse(FirstNonBlank(line.Warehouse, request.Warehouse, "RM").Trim().ToUpperInvariant());
            }
        }

        private static void ValidateSageMastersSql(GoodsReceiptRequest request)
        {
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            {
                connection.Open();

                if (!Exists(connection, "SELECT 1 FROM Vendor WHERE Account = @Value", request.SupplierCode.Trim()))
                    throw new InvalidOperationException("Sage supplier account not found: " + request.SupplierCode.Trim());

                var defaultWarehouse = FirstNonBlank(request.Warehouse, "RM").Trim().ToUpperInvariant();
                if (!Exists(connection, "SELECT 1 FROM Whsemst WHERE Code = @Value", defaultWarehouse))
                    throw new InvalidOperationException("Sage warehouse not found: " + defaultWarehouse);

                foreach (var line in request.Lines)
                {
                    var itemCode = line.ItemCode.Trim().ToUpperInvariant();
                    var warehouse = FirstNonBlank(line.Warehouse, request.Warehouse, "RM").Trim().ToUpperInvariant();

                    if (!Exists(connection, "SELECT 1 FROM StkItem WHERE Code = @Value AND ItemActive = 1", itemCode))
                        throw new InvalidOperationException("Sage stock item not found or inactive: " + itemCode);

                    if (!Exists(connection, "SELECT 1 FROM Whsemst WHERE Code = @Value", warehouse))
                        throw new InvalidOperationException("Sage warehouse not found: " + warehouse);
                }
            }
        }

        private static bool Exists(SqlConnection connection, string query, string value)
        {
            using (var command = new SqlCommand(query, connection))
            {
                command.Parameters.Add("@Value", SqlDbType.VarChar, 100).Value = value;
                return command.ExecuteScalar() != null;
            }
        }

        private static string ValidateRequest(GoodsReceiptRequest request)
        {
            if (request == null)
                return "A JSON goods-receipt request is required.";

            if (string.IsNullOrWhiteSpace(request.Reference))
                return "Reference is required.";

            if (string.IsNullOrWhiteSpace(request.SupplierCode))
                return "SupplierCode is required.";

            if (request.Lines == null || request.Lines.Length == 0)
                return "At least one goods-receipt line is required.";

            if (request.Lines.Length > 1)
                return "The GRV bridge currently supports one line per Sage GRV while HFGRV sequencing is being validated.";

            for (var i = 0; i < request.Lines.Length; i++)
            {
                var line = request.Lines[i];
                if (line == null)
                    return "Line " + (i + 1) + " is empty.";

                if (string.IsNullOrWhiteSpace(line.ItemCode))
                    return "Line " + (i + 1) + " ItemCode is required.";

                if (line.Quantity <= 0)
                    return "Line " + (i + 1) + " Quantity must be greater than zero.";

                if (line.UnitCost < 0)
                    return "Line " + (i + 1) + " UnitCost cannot be negative.";
            }

            return null;
        }

        private static object GoodsReceiptSummary(GoodsReceiptRequest request, string grvNumber)
        {
            return new
            {
                reference = request.Reference.Trim(),
                grvNumber = grvNumber,
                supplierCode = request.SupplierCode.Trim(),
                supplierName = request.SupplierName,
                supplierInvoiceNo = request.SupplierInvoiceNo,
                supplierDeliveryNoteNo = request.SupplierDeliveryNoteNo,
                supplierOrderNo = request.SupplierOrderNo,
                externalReference = request.ExternalReference,
                warehouse = FirstNonBlank(request.Warehouse, "RM").Trim().ToUpperInvariant(),
                receivedDate = request.ReceivedDate,
                lineCount = request.Lines == null ? 0 : request.Lines.Length,
                totalQuantity = request.Lines == null ? 0 : request.Lines.Sum(line => line.Quantity),
                lines = request.Lines
            };
        }

        private static string FirstNonBlank(params string[] values)
        {
            foreach (var value in values)
            {
                if (!string.IsNullOrWhiteSpace(value))
                    return value;
            }
            return "";
        }

        private static string Trim(string value, int length)
        {
            if (string.IsNullOrWhiteSpace(value))
                return "";
            value = value.Trim();
            return value.Length <= length ? value : value.Substring(0, length);
        }
    }
}
