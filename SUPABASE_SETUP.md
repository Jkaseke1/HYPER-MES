# Supabase Setup Instructions

## Pending Migrations to Apply

You have 3 new migrations that need to be applied to your Supabase database:

### 1. Add Sage Code Field to Formulations
**File:** `supabase/migrations/20260402_add_sage_code_to_formulations.sql`

```sql
-- Add sage_code field to formulations for Sage Pastel integration
ALTER TABLE formulations ADD COLUMN sage_code VARCHAR(50) UNIQUE;

-- Add comment explaining the field
COMMENT ON COLUMN formulations.sage_code IS 'Sage Pastel item code for integration and syncing';

-- Create index for faster lookups
CREATE INDEX idx_formulations_sage_code ON formulations(sage_code);
```

**Purpose:** Links formulations to Sage Pastel items for integration and syncing

---

### 2. Add Unit Size Variants to Formulations
**File:** `supabase/migrations/20260402_add_unit_size_variants_to_formulations.sql`

```sql
-- Add unit_size_variants JSONB field to store multiple unit size options
ALTER TABLE formulations ADD COLUMN unit_size_variants JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the field
COMMENT ON COLUMN formulations.unit_size_variants IS 'JSON array of unit size variants with batch sizes. Example: [{"size": "8kg", "batch_size": 800}, {"size": "10kg", "batch_size": 1000}, {"size": "25kg", "batch_size": 2500}]';

-- Create index for JSONB queries
CREATE INDEX idx_formulations_unit_size_variants ON formulations USING GIN (unit_size_variants);
```

**Purpose:** Consolidates multiple unit sizes (8kg, 10kg, 25kg) into ONE formulation with variants

**Example Usage:**
```json
[
  {"size": "8kg", "batch_size": 800},
  {"size": "10kg", "batch_size": 1000},
  {"size": "25kg", "batch_size": 2500}
]
```

---

### 3. Add BOM Validation Rules
**File:** `supabase/migrations/20260402_add_bom_validation.sql`

```sql
-- Add constraint to prevent 0 quantity ingredients in BOM
ALTER TABLE formulation_ingredients 
ADD CONSTRAINT check_positive_quantity CHECK (quantity > 0);

-- Add constraint to ensure percentage is between 0 and 100
ALTER TABLE formulation_ingredients 
ADD CONSTRAINT check_valid_percentage CHECK (percentage >= 0 AND percentage <= 100);

-- Create function to validate BOM totals
CREATE OR REPLACE FUNCTION validate_bom_total_percentage()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if total percentage for this formulation is close to 100%
  -- Allow 0.1% tolerance for rounding
  IF (SELECT ABS(SUM(percentage) - 100) > 0.1 
      FROM formulation_ingredients 
      WHERE formulation_id = NEW.formulation_id) THEN
    RAISE EXCEPTION 'BOM ingredients must total 100%% (currently: %%)', 
      (SELECT SUM(percentage) FROM formulation_ingredients WHERE formulation_id = NEW.formulation_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate BOM percentages on insert/update
CREATE TRIGGER trigger_validate_bom_percentage
AFTER INSERT OR UPDATE ON formulation_ingredients
FOR EACH ROW
EXECUTE FUNCTION validate_bom_total_percentage();
```

**Purpose:** Prevents invalid BOM data (0kg ingredients, invalid percentages)

---

## How to Apply Migrations

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste each migration SQL (in order):
   - First: `20260402_add_sage_code_to_formulations.sql`
   - Second: `20260402_add_unit_size_variants_to_formulations.sql`
   - Third: `20260402_add_bom_validation.sql`
6. Click **Run** for each query

### Option 2: Using Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref your_project_ref

# Apply migrations
supabase db push
```

---

## After Migrations Are Applied

### Update Existing Formulations with Sage Codes

Go to the Formulations page in the app and:

1. Click **View** on each formulation
2. Click **Edit Formula**
3. Enter the **Sage Code** (e.g., "HDC25", "HDC10", "HDC8")
4. Click **Save Formula**

### Consolidate Unit Sizes (Example: Dog Food)

Instead of having 3 separate formulations:
- Hyper Dog Chunks 10kg
- Hyper Dog Chunks 25kg
- Hyper Dog Chunks 8kg

Create ONE formulation "Hyper Dog Chunks" with unit_size_variants:

```json
[
  {"size": "8kg", "batch_size": 800},
  {"size": "10kg", "batch_size": 1000},
  {"size": "25kg", "batch_size": 2500}
]
```

---

## Verification

After applying migrations, verify by running this query in Supabase SQL Editor:

```sql
-- Check if sage_code column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'formulations' AND column_name = 'sage_code';

-- Check if unit_size_variants column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'formulations' AND column_name = 'unit_size_variants';

-- Check if constraints exist
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_name = 'formulation_ingredients' 
AND constraint_name LIKE 'check_%';
```

All three should return results if migrations were successful.

---

## Troubleshooting

**Error: "Column already exists"**
- The migration has already been applied. No action needed.

**Error: "Constraint violation"**
- You have existing BOM ingredients with 0 quantity or invalid percentages
- Update them before applying the validation migration

**Error: "Function already exists"**
- The trigger function has already been created. No action needed.
