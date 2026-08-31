# Daily Supabase Backup

This backup is run on the production application server by Windows Task Scheduler. It writes a compressed PostgreSQL roles, schema, and data dump, plus a SHA-256 checksum, outside the application deployment directory.

## One-time server setup

1. Install Docker and the Supabase CLI, then ensure `supabase` is on the SYSTEM account's PATH. The CLI runs the PostgreSQL dump tooling in a container.
2. Create a local or network-backed backup location, for example `D:\PlantControlBackups\Supabase`. The location should be included in the server's off-machine backup policy.
3. Set `SUPABASE_DB_URL` as a **machine** environment variable. Use the production PostgreSQL connection URL, not an anon key or service-role key.
4. Open an elevated PowerShell window in the deployed project directory and run:

```powershell
.\scripts\install-daily-supabase-backup.ps1 -BackupDirectory 'D:\PlantControlBackups\Supabase' -Time '01:15' -RetentionDays 30
```

5. Run the task once from Task Scheduler and confirm that a `.zip` and matching `.sha256` file are created.

## Restore check

Each quarter, restore the latest backup into a separate non-production Supabase project. Verify the checksum first, apply `roles.sql`, `schema.sql`, then load `data.sql`. Do not restore directly over the production database without an approved recovery decision.

## Platform protection

Keep Supabase managed backups and point-in-time recovery enabled for the production project where the subscription supports them. Provider backups cover the managed project more completely, including Auth and Storage; the scheduled dump is an independent database recovery copy and does not include files stored in Supabase Storage.
