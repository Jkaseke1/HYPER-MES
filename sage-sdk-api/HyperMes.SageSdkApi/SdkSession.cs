using Pastel.Evolution;
using System;

namespace SDK_Test
{
    public static class SdkSession
    {
        private static readonly object ConnectionLock = new object();
        private static bool _connected;

        public static void EnsureConnected()
        {
            lock (ConnectionLock)
            {
                if (_connected)
                    return;

                var server = GetRequiredSetting("HYPER_SAGE_SERVER");
                var commonDatabase = GetRequiredSetting("HYPER_SAGE_COMMON_DATABASE");
                var companyDatabase = GetRequiredSetting("HYPER_SAGE_COMPANY_DATABASE");
                var sqlUsername = GetRequiredSetting("HYPER_SAGE_SQL_USERNAME");
                var sqlPassword = GetRequiredSetting("HYPER_SAGE_SQL_PASSWORD");
                var sdkSerial = GetRequiredSetting("HYPER_SAGE_SDK_SERIAL");
                var sdkAuthCode = GetRequiredSetting("HYPER_SAGE_SDK_AUTH_CODE");

                DatabaseContext.CreateCommonDBConnection(
                    server, commonDatabase, sqlUsername, sqlPassword, false);

                DatabaseContext.SetLicense(sdkSerial, sdkAuthCode);

                DatabaseContext.CreateConnection(
                    server, companyDatabase, sqlUsername, sqlPassword, false);

                _connected = true;
            }
        }

        private static string GetRequiredSetting(string name)
        {
            var value = Environment.GetEnvironmentVariable(name);

            if (string.IsNullOrWhiteSpace(value))
                throw new InvalidOperationException(
                    "Missing Windows environment variable: " + name);

            return value;
        }
    }
}