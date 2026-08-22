using Microsoft.Owin.Hosting;
using System;

namespace SDK_Test
{
    internal class Program
    {
        private static void Main(string[] args)
        {
            const string baseAddress = "http://127.0.0.1:5088/";

            using (WebApp.Start<Startup>(baseAddress))
            {
                Console.WriteLine("Hyperfeeds Sage SDK API is running in UAT mode.");
                Console.WriteLine("Health check: http://127.0.0.1:5088/api/v1/health");
                Console.WriteLine("Press Enter to stop the API.");
                Console.ReadLine();
            }
        }
    }
}