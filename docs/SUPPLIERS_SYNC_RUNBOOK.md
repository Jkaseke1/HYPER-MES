# Suppliers Sync Runbook

**Symptom:** GRN screen Supplier dropdown is missing several active suppliers that do exist in Sage.

**Root cause:** MES `suppliers` table was seeded once, manually. There is no live bridge sync from Sage → MES for masters (unlike transactions, which flow MES → Sage). Any supplier added in Sage after the initial seed is invisible to MES.

This runbook imports the current Sage supplier master into MES.

---

## Step 1 — Inspect current MES suppliers

```sql
select count(*)                                              as total,
       count(*) filter (where is_active)                     as active,
       count(*) filter (where sage_code is null or sage_code = '') as missing_sage
from suppliers;

-- which active suppliers are missing sage_code?
select code, name, sage_code from suppliers
where is_active and (sage_code is null or sage_code = '')
order by name;
```

---

## Step 2 — Export suppliers from Sage Pastel (Hyperfeeds 2024)

Run in **SQL Server Management Studio** against the Sage company DB. The table is typically `_btblSupplier` in Sage Pastel Partner / Xpress:

```sql
-- Sage Pastel Partner / Xpress
SELECT
  ltrim(rtrim(Supplier))    AS sage_code,
  ltrim(rtrim(SuppName))    AS name,
  ltrim(rtrim(SuppAdd1))    AS address1,
  ltrim(rtrim(SuppTel))     AS phone,
  ltrim(rtrim(SuppContact)) AS contact_person,
  ltrim(rtrim(Email))       AS email,
  ltrim(rtrim(SPayTerms))   AS payment_terms,
  IsActive                  AS is_active
FROM _btblSupplier
WHERE (IsActive = 1 OR IsActive IS NULL)
ORDER BY Supplier;
```

> Column names vary slightly across Sage Pastel versions. If the query errors, run `sp_columns _btblSupplier` and adjust. For Evolution it's `SupplierMaster`.

**Export the result as CSV** with header row: `sage_code,name,address1,phone,contact_person,email,payment_terms,is_active`.

Save as `suppliers_from_sage.csv`.

---

## Step 3 — Stage the CSV in Supabase

In Supabase SQL Editor:

```sql
create table if not exists _staging_suppliers (
  sage_code text,
  name text,
  address1 text,
  phone text,
  contact_person text,
  email text,
  payment_terms text,
  is_active int
);

truncate _staging_suppliers;
```

Use the Supabase Table Editor "Import CSV" button on `_staging_suppliers` to upload the file.

---

## Step 4 — Upsert into `suppliers`

```sql
-- Insert new suppliers, update existing ones matched by sage_code.
-- Uses sage_code as the natural key. MES `code` is set = sage_code if new.
insert into suppliers (code, name, sage_code, contact_person, email, phone, address, payment_terms, is_active)
select s.sage_code, s.name, s.sage_code,
       coalesce(s.contact_person,''), coalesce(s.email,''), coalesce(s.phone,''),
       coalesce(s.address1,''), coalesce(s.payment_terms,''),
       coalesce(s.is_active,1) = 1
from _staging_suppliers s
where s.sage_code is not null and s.sage_code <> ''
on conflict (code) do update set
  name           = excluded.name,
  sage_code      = excluded.sage_code,
  contact_person = excluded.contact_person,
  email          = excluded.email,
  phone          = excluded.phone,
  address        = excluded.address,
  payment_terms  = excluded.payment_terms,
  is_active      = excluded.is_active,
  updated_at     = now();

-- backfill sage_code on any legacy MES rows whose code matches a Sage supplier
update suppliers sup
set sage_code = s.sage_code, updated_at = now()
from _staging_suppliers s
where (sup.sage_code is null or sup.sage_code='')
  and upper(sup.code) = upper(s.sage_code);

-- deactivate suppliers no longer in Sage (optional, review first)
-- update suppliers set is_active=false
-- where sage_code not in (select sage_code from _staging_suppliers);

-- cleanup
drop table _staging_suppliers;
```

---

## Step 5 — Verify

```sql
select count(*) as total,
       count(*) filter (where is_active) as active,
       count(*) filter (where sage_code <> '') as with_sage
from suppliers;
```

Reload the GRN page — all active suppliers now in the dropdown.

---

## Future: keep them in sync

Options, in rough order of effort:

1. **Re-run this runbook quarterly** (simplest).
2. Add a one-shot "Import Suppliers from Sage" button in the MES Settings page that posts the CSV directly to the Supabase REST API.
3. Extend the bridge worker with a reverse pull job (Sage → MES) for masters (suppliers, customers, stock items). Currently it only pushes MES → Sage.
