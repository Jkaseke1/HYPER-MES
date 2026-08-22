using Pastel.Evolution;
using System;
using System.Collections.Concurrent;
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

                var grvNumber = PostGoodsReceivedVoucher(request);

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

        private static string PostGoodsReceivedVoucher(GoodsReceiptRequest request)
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

            // Sage controls the GRV number through its configured HFGRV sequence.
            return purchaseOrder.ProcessStock();
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
