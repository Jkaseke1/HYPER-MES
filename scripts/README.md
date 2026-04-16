# HYPER-MES Seed Scripts

## seedMacropackBOMs.js

Seeds the `macropack_boms` and `macropack_bom_ingredients` tables with 8 macropack formulations.

### Prerequisites

1. **Supabase Service Key** — Required to bypass RLS policies
   - Go to: https://app.supabase.com/project/appyuqxetlphuxfybmus/settings/api
   - Copy the **service_role** key (NOT the anon key)

2. **Raw Materials** — Must be seeded first in the `raw_materials` table
   - The script looks up materials by code (e.g., BSP0001, MET0001, etc.)
   - If materials don't exist, ingredients will be skipped

### Usage

```bash
# PowerShell
$env:SUPABASE_SERVICE_KEY="<your-service-role-key>"
node scripts/seedMacropackBOMs.js

# Bash
export SUPABASE_SERVICE_KEY="<your-service-role-key>"
node scripts/seedMacropackBOMs.js
```

### Macropacks Seeded

1. **BRO_STARTER** — Broiler Starter (8 ingredients)
2. **BRO_GROWER** — Broiler Grower (8 ingredients)
3. **BRO_FINISHER** — Broiler Finisher (9 ingredients)
4. **LIP_MASH** — Layer In Production Mash (5 ingredients)
5. **DOG** — Dog Macropack (7 ingredients)
6. **DAIRY** — Dairy Macropack (4 ingredients)
7. **PIG_GROWER** — Pig Grower (6 ingredients)
8. **RABBIT** — Rabbit (6 ingredients)

### Output

The script logs:
- ✅ Success: BOMs created with all ingredients
- ⚠️ Partial: BOM created but some ingredients missing (material not found)
- ⏭️ Skipped: BOM already exists
- ❌ Failed: BOM creation failed (RLS, validation, etc.)

### Notes

- All BOMs are created with `version = 1` and `is_active = true`
- Ingredients are measured in grams
- The script is idempotent — running it twice won't create duplicates (checks by macropack_code)
