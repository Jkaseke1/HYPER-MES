import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).trim();
      if (key && value) {
        envVars[key] = value;
      }
    }
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL || 'https://appyuqxetlphuxfybmus.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase Service Key');
  console.error('\n📋 To get your service key:');
  console.error('   1. Go to: https://app.supabase.com/project/appyuqxetlphuxfybmus/settings/api');
  console.error('   2. Copy the "service_role" key (NOT the anon key)');
  console.error('   3. Run: $env:SUPABASE_SERVICE_KEY="<paste-key-here>"; node scripts/seedMacropackBOMs.js');
  console.error('\nFound in .env:', Object.keys(envVars));
  process.exit(1);
}

console.log(`✅ Using Supabase URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

const MACROPACKS = [
  {
    code: 'BRO_STARTER',
    name: 'Broiler Starter',
    ingredients: {
      'BSP0001': 380,
      'MET0001': 334.4,
      'LSN0001': 304,
      'MCP0001': 1140,
      'SSP0001': 60.8,
      'CHO0001': 18.4,
      'LIF0001': 357,
      'SAC0001': 1900,
    }
  },
  {
    code: 'BRO_GROWER',
    name: 'Broiler Grower',
    ingredients: {
      'BGP0001': 450,
      'MET0001': 396,
      'LSN0001': 360,
      'MCP0001': 1260,
      'SSP0001': 63,
      'CHO0001': 33,
      'LIF0001': 630,
      'SAC0001': 2304,
    }
  },
  {
    code: 'BRO_FINISHER',
    name: 'Broiler Finisher',
    ingredients: {
      'BSP0001': 125,
      'BGP0001': 125,
      'MET0001': 180,
      'LSN0001': 160,
      'MCP0001': 500,
      'SSP0001': 30,
      'CHO0001': 20,
      'LIF0001': 350,
      'SAC0001': 1200,
    }
  },
  {
    code: 'LIP_MASH',
    name: 'Layer In Production Mash',
    ingredients: {
      'LAP0001': 200,
      'MET0001': 136,
      'LSN0001': 55,
      'MCP0001': 520,
      'LIF0001': 304,
    }
  },
  {
    code: 'DOG',
    name: 'Dog Macropack',
    ingredients: {
      'BSP0001': 8.33,
      'BGP0001': 17,
      'MET0001': 6,
      'LSN0001': 6,
      'KAL0001': 60,
      'SAF0001': 300,
      'SAC0001': 300,
    }
  },
  {
    code: 'DAIRY',
    name: 'Dairy Macropack',
    ingredients: {
      'DAP0001': 98.8,
      'KAL0001': 104,
      'SAF0001': 353.6,
      'LIF0001': 1274,
    }
  },
  {
    code: 'PIG_GROWER',
    name: 'Pig Grower',
    ingredients: {
      'BGP0001': 75,
      'MET0001': 36,
      'LSN0001': 15,
      'MCP0001': 90,
      'LIF0001': 120,
      'SAF0001': 360,
    }
  },
  {
    code: 'RABBIT',
    name: 'Rabbit',
    ingredients: {
      'BGP0001': 115,
      'MET0001': 55.2,
      'LSN0001': 46,
      'SSP0001': 9.2,
      'KAL0001': 92,
      'LIF0001': 115,
      'SAF0001': 368,
    }
  },
];

async function seedMacropackBOMs() {
  console.log('🌱 Starting Macropack BOM seed...\n');

  // Fetch all raw materials
  const { data: materials, error: materialsError } = await supabase
    .from('raw_materials')
    .select('id, code, name');

  if (materialsError) {
    console.error('❌ Failed to fetch raw materials:', materialsError.message);
    process.exit(1);
  }

  const materialMap = {};
  materials.forEach(m => {
    materialMap[m.code] = m.id;
  });

  console.log(`✅ Loaded ${materials.length} raw materials\n`);

  let successCount = 0;
  let skipCount = 0;
  let failureCount = 0;

  for (const mp of MACROPACKS) {
    try {
      // Check if macropack already exists
      const { data: existing } = await supabase
        .from('macropack_boms')
        .select('id')
        .eq('macropack_code', mp.code)
        .single();

      if (existing) {
        console.log(`⏭️  ${mp.code} — ${mp.name} (already exists, skipping)`);
        skipCount++;
        continue;
      }

      // Insert macropack BOM
      const { data: bomData, error: bomError } = await supabase
        .from('macropack_boms')
        .insert({
          macropack_code: mp.code,
          macropack_name: mp.name,
          version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (bomError) {
        console.error(`❌ ${mp.code} — Failed to insert BOM:`, bomError.message);
        failureCount++;
        continue;
      }

      // Insert ingredients
      const ingredientRecords = [];
      let missingMaterials = [];

      for (const [rmCode, qty] of Object.entries(mp.ingredients)) {
        const rmId = materialMap[rmCode];
        if (!rmId) {
          missingMaterials.push(rmCode);
          continue;
        }
        ingredientRecords.push({
          macropack_bom_id: bomData.id,
          raw_material_id: rmId,
          quantity_grams: qty,
        });
      }

      if (ingredientRecords.length > 0) {
        const { error: ingredError } = await supabase
          .from('macropack_bom_ingredients')
          .insert(ingredientRecords);

        if (ingredError) {
          console.error(`❌ ${mp.code} — Failed to insert ingredients:`, ingredError.message);
          failureCount++;
          continue;
        }
      }

      if (missingMaterials.length > 0) {
        console.log(`⚠️  ${mp.code} — ${mp.name} (${ingredientRecords.length}/${Object.keys(mp.ingredients).length} ingredients) — missing: ${missingMaterials.join(', ')}`);
      } else {
        console.log(`✅ ${mp.code} — ${mp.name} (${ingredientRecords.length} ingredients)`);
      }
      successCount++;

    } catch (err) {
      console.error(`❌ ${mp.code} — Unexpected error:`, err.message);
      failureCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Success: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log('='.repeat(60));
}

seedMacropackBOMs().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
