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
        private static readonly object GrvNumberLock = new object();

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
            var existingGrvNumber = FindStandaloneGrvByMesReference(reference);
            if (!string.IsNullOrWhiteSpace(existingGrvNumber))
                return Ok(PostedGoodsReceiptResponse(request, existingGrvNumber, "already-posted"));

            if (!PostedReferences.TryAdd(reference, true))
            {
                existingGrvNumber = FindStandaloneGrvByMesReference(reference);
                if (!string.IsNullOrWhiteSpace(existingGrvNumber))
                    return Ok(PostedGoodsReceiptResponse(request, existingGrvNumber, "already-posted"));

                return StatusCode(System.Net.HttpStatusCode.Conflict);
            }

            try
            {
                SdkSession.EnsureConnected();
                ValidateSageMasters(request);

                string grvNumber;
                lock (GrvNumberLock)
                {
                    grvNumber = GetNextSageGrvNumber();
                    PostStandaloneGoodsReceivedVoucher(request, grvNumber);
                    AdvanceSageGrvSequence(grvNumber);
                }

                return Ok(PostedGoodsReceiptResponse(request, grvNumber, "posted"));
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

        private static object PostedGoodsReceiptResponse(GoodsReceiptRequest request, string grvNumber, string status)
        {
            var alreadyPosted = string.Equals(status, "already-posted", StringComparison.OrdinalIgnoreCase);
            return new
            {
                status = status,
                environment = "UAT",
                action = "goods-receipt-grv",
                postingMode = "legacy-standalone-grv",
                sagePosting = "completed",
                grvNumber = grvNumber,
                documentNumber = grvNumber,
                message = alreadyPosted
                    ? "Sage UAT already contains this standalone GRV; returning the existing posting."
                    : "Goods receipt posted to Sage UAT as a standalone GRV.",
                goodsReceipt = GoodsReceiptSummary(request, grvNumber)
            };
        }

        private static string FindStandaloneGrvByMesReference(string mesReference)
        {
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            using (var command = new SqlCommand(@"
                SELECT TOP 1 inv.InvNumber
                FROM PostAP AS ap
                INNER JOIN InvNum AS inv ON inv.AutoIndex = ap.InvNumKey
                WHERE ap.Id = 'Grv'
                  AND ap.cReference2 = @MesReference
                  AND inv.DocType = 2
                ORDER BY ap.AutoIdx DESC;", connection))
            {
                command.Parameters.Add("@MesReference", SqlDbType.VarChar, 50).Value = mesReference;
                connection.Open();
                return command.ExecuteScalar() as string;
            }
        }

        private static string GetNextSageGrvNumber()
        {
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            using (var command = new SqlCommand(@"
                SELECT COALESCE(MAX(TRY_CONVERT(int, SUBSTRING(GrvValue, 6, 6))), 0) + 1
                FROM (
                    SELECT InvNumber AS GrvValue FROM InvNum WHERE DocType = 2 AND InvNumber LIKE 'HFGRV[0-9]%'
                    UNION ALL
                    SELECT GrvNumber AS GrvValue FROM InvNum WHERE DocType = 2 AND GrvNumber LIKE 'HFGRV[0-9]%'
                ) AS Numbers
                WHERE LEN(GrvValue) = 11
                  AND TRY_CONVERT(int, SUBSTRING(GrvValue, 6, 6)) IS NOT NULL;", connection))
            {
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

        private static void PostStandaloneGoodsReceivedVoucher(GoodsReceiptRequest request, string grvNumber)
        {
            var txDate = request.ReceivedDate == default(DateTime)
                ? DateTime.Today
                : request.ReceivedDate.Date;

            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            {
                connection.Open();
                foreach (var line in request.Lines)
                {
                    using (var command = new SqlCommand("dbo.PostGRVV2", connection))
                    {
                        command.CommandType = CommandType.StoredProcedure;
                        command.CommandTimeout = 120;
                        command.Parameters.Add("@ItemCode", SqlDbType.VarChar, 50).Value = line.ItemCode.Trim().ToUpperInvariant();
                        command.Parameters.Add("@InventoryTransactionCode", SqlDbType.VarChar, 50).Value = "GRV";
                        command.Parameters.Add("@Quantity", SqlDbType.Float).Value = (double)line.Quantity;
                        command.Parameters.Add("@WHCode", SqlDbType.VarChar, 50).Value = FirstNonBlank(line.Warehouse, request.Warehouse, "RM").Trim().ToUpperInvariant();
                        command.Parameters.Add("@LotNumber", SqlDbType.VarChar, 50).Value = Trim(line.LotNumber, 50);
                        command.Parameters.Add("@UnitCost", SqlDbType.Float).Value = (double)line.UnitCost;
                        command.Parameters.Add("@ProjectID", SqlDbType.Int).Value = 0;
                        command.Parameters.Add("@TradePayablesAccountCode", SqlDbType.VarChar, 100).Value = "";
                        command.Parameters.Add("@VarianceAccountCode", SqlDbType.VarChar, 100).Value = "";
                        command.Parameters.Add("@Reference", SqlDbType.VarChar, 50).Value = grvNumber;
                        command.Parameters.Add("@Reference2", SqlDbType.VarChar, 50).Value = Trim(request.Reference, 50);
                        command.Parameters.Add("@TransactionDate", SqlDbType.DateTime).Value = txDate;
                        command.Parameters.Add("@Description", SqlDbType.VarChar, 255).Value = Trim(FirstNonBlank(line.Description, "Goods Received Voucher"), 255);
                        command.Parameters.Add("@UserName", SqlDbType.VarChar, 50).Value = "HYPER MES";
                        command.Parameters.Add("@SupplierCode", SqlDbType.VarChar, 50).Value = request.SupplierCode.Trim();
                        command.ExecuteNonQuery();
                    }
                }
            }

            ValidateStandaloneGrvDocument(grvNumber);
        }

        private static void ValidateStandaloneGrvDocument(string grvNumber)
        {
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            using (var command = new SqlCommand(@"
                SELECT TOP 1 DocType FROM InvNum
                WHERE InvNumber = @GrvNumber OR GrvNumber = @GrvNumber
                ORDER BY CASE WHEN InvNumber = @GrvNumber THEN 0 ELSE 1 END, AutoIndex;", connection))
            {
                command.Parameters.Add("@GrvNumber", SqlDbType.VarChar, 50).Value = grvNumber;
                connection.Open();
                var docType = command.ExecuteScalar();
                if (docType == null || Convert.ToInt32(docType) != (int)DocumentType.GoodsReceivedVoucher)
                    throw new InvalidOperationException("Sage did not create standalone Goods Received Voucher " + grvNumber + ".");
            }
        }

        private static void AdvanceSageGrvSequence(string grvNumber)
        {
            var sequence = int.Parse(grvNumber.Substring(5));
            using (var connection = new SqlConnection(GetCompanyConnectionString()))
            using (var command = new SqlCommand(@"
                UPDATE StDfTbl SET GrvNum = CASE WHEN ISNULL(GrvNum, 0) < @Sequence THEN @Sequence ELSE GrvNum END;", connection))
            {
                command.Parameters.Add("@Sequence", SqlDbType.Int).Value = sequence;
                connection.Open();
                command.ExecuteNonQuery();
            }
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
