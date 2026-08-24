using Pastel.Evolution;
using System;
using System.Net;
using System.Web.Http;

namespace SDK_Test
{
    [RoutePrefix("api/v1/sdk")]
    public class SdkConnectionController : ApiController
    {
        private static readonly object ConnectionLock = new object();
        private static bool _sdkConnected;

        [HttpGet]
        [Route("connection")]
        public IHttpActionResult CheckConnection()
        {
            try
            {
                lock (ConnectionLock)
                {
                    if (!_sdkConnected)
                    {
                        var commonServer = GetServerSetting("HYPER_SAGE_COMMON_SERVER");
                        var companyServer = GetServerSetting("HYPER_SAGE_COMPANY_SERVER");
                        var commonDatabase = GetRequiredSetting("HYPER_SAGE_COMMON_DATABASE");
                        var companyDatabase = GetRequiredSetting("HYPER_SAGE_COMPANY_DATABASE");
                        var sqlUsername = GetRequiredSetting("HYPER_SAGE_SQL_USERNAME");
                        var sqlPassword = GetRequiredSetting("HYPER_SAGE_SQL_PASSWORD");
                        var sdkSerial = GetRequiredSetting("HYPER_SAGE_SDK_SERIAL");
                        var sdkAuthCode = GetRequiredSetting("HYPER_SAGE_SDK_AUTH_CODE");

                        DatabaseContext.CreateCommonDBConnection(
                            commonServer,
                            commonDatabase,
                            sqlUsername,
                            sqlPassword,
                            false
                        );

                        DatabaseContext.SetLicense(sdkSerial, sdkAuthCode);

                        DatabaseContext.CreateConnection(
                            companyServer,
                            companyDatabase,
                            sqlUsername,
                            sqlPassword,
                            false
                        );

                        _sdkConnected = true;
                    }
                }

                return Ok(new
                {
                    status = "ok",
                    environment = "UAT",
                    companyDatabase = "Hyperfeeds 2026 UAT",
                    commonDatabase = "SageCommon",
                    sdkConnection = "successful",
                    message = "SDK connection verified. No Sage transaction was created."
                });
            }
            catch (Exception ex)
            {
                return Content(HttpStatusCode.ServiceUnavailable, new
                {
                    status = "failed",
                    environment = "UAT",
                    sdkConnection = "failed",
                    message = ex.Message
                });
            }
        }

        private static string GetRequiredSetting(string name)
        {
            var value = Environment.GetEnvironmentVariable(name);

            if (string.IsNullOrWhiteSpace(value))
            {
                throw new InvalidOperationException(
                    "Missing Windows environment variable: " + name
                );
            }

            return value;
        }

        private static string GetServerSetting(string specificName)
        {
            var value = Environment.GetEnvironmentVariable(specificName);
            if (!string.IsNullOrWhiteSpace(value)) return value;
            return GetRequiredSetting("HYPER_SAGE_SERVER");
        }
    }
}
