-- Multi-branch full-cycle seed data (10 branches, 6 months)
-- Run via CLI: `supabase db execute supabase/seeds/20260319101500_seed_multi_branch_cycle.sql`

DO $$
DECLARE
  branch_defs jsonb := '[
    {"code":"DEMO-BR01","name":"North Hub"},
    {"code":"DEMO-BR02","name":"South Hub"},
    {"code":"DEMO-BR03","name":"East Hub"},
    {"code":"DEMO-BR04","name":"West Hub"},
    {"code":"DEMO-BR05","name":"Central Depot"},
    {"code":"DEMO-BR06","name":"Lakeside Depot"},
    {"code":"DEMO-BR07","name":"Highland Depot"},
    {"code":"DEMO-BR08","name":"Lowveld Depot"},
    {"code":"DEMO-BR09","name":"Coastal Depot"},
    {"code":"DEMO-BR10","name":"Valley Depot"}
  ]';
  raw_defs jsonb := '[
    {"suffix":"RM-A","name":"Energy Blend","category":"grain","cost":0.32,"reorder":6000,"stock":22000},
    {"suffix":"RM-B","name":"Protein Meal","category":"protein","cost":0.48,"reorder":3500,"stock":15000},
    {"suffix":"RM-C","name":"Vitamin Premix","category":"vitamin","cost":1.20,"reorder":900,"stock":4000},
    {"suffix":"RM-D","name":"Mineral Mix","category":"mineral","cost":0.62,"reorder":1200,"stock":5000}
  ]';
  form_defs jsonb := '[
    {"code":"DEMO-FORM-ST","name":"Starter Pellet","description":"Demo starter formulation"},
    {"code":"DEMO-FORM-GR","name":"Grower Meal","description":"Demo grower formulation"},
    {"code":"DEMO-FORM-FG","name":"Finisher Blend","description":"Demo finisher formulation"}
  ]';
  supplier_id uuid;
  form_ids uuid[] := ARRAY[]::uuid[];
  form_def record;
  branch_def record;
  raw_def record;
  branch_code text;
  branch_name text;
  branch_id uuid;
  rm_wh_id uuid;
  fg_wh_id uuid;
  machine_id uuid;
  rm_id uuid;
  rm_rec record;
  form_id uuid;
  month_cursor date;
  start_month date := date_trunc('month', CURRENT_DATE - INTERVAL '5 months');
  end_month date := date_trunc('month', CURRENT_DATE);
  receipt_date date;
  issue_date date;
  grn_id uuid;
  qty numeric;
  line_total numeric;
  prod_id uuid;
  dispatch_id uuid;
  recon_period_id uuid;
  macropack_id uuid;
  rm_for_usage uuid;
  observation_severity text;
BEGIN
  -- cleanup previous demo data
  DELETE FROM recon_macropack_usage WHERE recon_macropack_id IN (SELECT id FROM recon_macropacks WHERE comments LIKE 'Demo seeded%');
  DELETE FROM recon_macropacks WHERE comments LIKE 'Demo seeded%';
  DELETE FROM recon_finished_goods WHERE comments LIKE 'Demo seeded%';
  DELETE FROM recon_production WHERE comments LIKE 'Demo seeded%';
  DELETE FROM recon_raw_materials WHERE comments LIKE 'Demo seeded%';
  DELETE FROM recon_observations WHERE observation LIKE 'Demo seeded%';
  DELETE FROM reconciliation_periods WHERE notes LIKE 'Demo seeded%';

  DELETE FROM dispatch_orders WHERE dispatch_number LIKE 'DEMO-%';
  DELETE FROM production_orders WHERE batch_number LIKE 'DEMO-%';
  DELETE FROM stock_movements WHERE reference_type = 'multi_branch_seed';
  DELETE FROM grn_items USING raw_materials rm WHERE grn_items.raw_material_id = rm.id AND rm.code LIKE 'DEMO-%';
  DELETE FROM goods_received_notes WHERE grn_number LIKE 'DEMO-%';

  DELETE FROM machines WHERE code LIKE 'DEMO-%';
  DELETE FROM raw_materials WHERE code LIKE 'DEMO-%';
  DELETE FROM warehouses WHERE code LIKE 'DEMO-%';
  DELETE FROM branches WHERE code LIKE 'DEMO-%';

  -- ensure supplier
  INSERT INTO suppliers (name, code, contact_person, email, phone, address, payment_terms, is_active)
  VALUES ('Demo Supplier', 'DEMO-SUP', 'Demo Contact', 'demo-supplier@example.com', '000-000-0000', 'Demo Industrial District', '30 days', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO supplier_id;

  -- ensure formulations
  FOR form_def IN SELECT jsonb_array_elements(form_defs) AS elem LOOP
    INSERT INTO formulations (name, code, version, category, description, batch_size, batch_unit, target_protein, target_fat, target_fiber, target_moisture, estimated_cost_per_unit, status)
    VALUES (form_def.elem->>'name', form_def.elem->>'code', 1, 'other', form_def.elem->>'description', 50, 't', 22, 6, 3, 12, 450, 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO form_id;
    IF form_id IS NULL THEN
      SELECT id INTO form_id FROM formulations WHERE code = form_def.elem->>'code' LIMIT 1;
    END IF;
    form_ids := array_append(form_ids, form_id);
  END LOOP;

  -- iterate branches
  FOR branch_def IN SELECT jsonb_array_elements(branch_defs) AS elem LOOP
    branch_code := branch_def.elem->>'code';
    branch_name := branch_def.elem->>'name';

    INSERT INTO branches (name, code, address, contact_person, phone, is_active)
    VALUES (branch_name, branch_code, branch_name || ' Estate', branch_name || ' Manager', '000-000-0000', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO branch_id;

    INSERT INTO warehouses (name, code, type, branch_id, location, is_active)
    VALUES (branch_name || ' RM Warehouse', branch_code || '-RM-WH', 'raw_material', branch_id, branch_name || ' Park', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO rm_wh_id;

    INSERT INTO warehouses (name, code, type, branch_id, location, is_active)
    VALUES (branch_name || ' FG Warehouse', branch_code || '-FG-WH', 'finished_goods', branch_id, branch_name || ' Park', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO fg_wh_id;

    INSERT INTO machines (name, code, type, capacity_per_hour, capacity_unit, status, is_active)
    VALUES (branch_name || ' Mixer', branch_code || '-MX-01', 'mixer', 12, 't', 'operational', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO machine_id;

    -- branch-specific raw materials
    FOR raw_def IN SELECT jsonb_array_elements(raw_defs) AS elem LOOP
      INSERT INTO raw_materials (name, code, category, unit, cost_per_unit, currency_code, cost_per_unit_usd, reorder_level, current_stock, warehouse_id, description, is_active, alert_threshold_pct, days_of_cover_target, alert_channels)
      VALUES (
        ((raw_def.elem->>'name')::text || ' - ' || branch_name),
        (branch_code || '-' || (raw_def.elem->>'suffix')::text),
        (raw_def.elem->>'category')::text,
        'kg',
        (raw_def.elem->>'cost')::numeric,
        'USD',
        (raw_def.elem->>'cost')::numeric,
        (raw_def.elem->>'reorder')::numeric,
        (raw_def.elem->>'stock')::numeric + (random() * 3000),
        rm_wh_id,
        'Demo seeded raw material',
        true,
        0.15,
        10,
        ARRAY['dashboard']
      )
      ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;
    END LOOP;

    -- per-month cycle
    month_cursor := start_month;
    WHILE month_cursor <= end_month LOOP
      receipt_date := month_cursor + ((random() * 5)::int);
      issue_date := month_cursor + 10 + ((random() * 8)::int);

      -- GRN
      INSERT INTO goods_received_notes (grn_number, supplier_id, warehouse_id, received_date, status, notes, received_by, total_value, created_at, updated_at)
      VALUES (
        format('DEMO-%s-GRN-%s', branch_code, to_char(month_cursor, 'YYYYMM')),
        supplier_id,
        rm_wh_id,
        receipt_date,
        'approved',
        'Demo seeded GRN',
        NULL,
        0,
        receipt_date,
        receipt_date
      )
      RETURNING id INTO grn_id;

      FOR rm_rec IN SELECT id, cost_per_unit FROM raw_materials WHERE code LIKE branch_code || '-RM-%' LOOP
        qty := 2000 + random() * 800;
        line_total := qty * COALESCE(rm_rec.cost_per_unit, 0.5);
        INSERT INTO grn_items (grn_id, raw_material_id, ordered_qty, received_qty, unit_cost, batch_number, expiry_date, line_total)
        VALUES (grn_id, rm_rec.id, qty, qty, COALESCE(rm_rec.cost_per_unit, 0.5), 'DEMO-' || to_char(receipt_date, 'YYYYMMDD'), receipt_date + INTERVAL '180 days', line_total);
        UPDATE goods_received_notes SET total_value = total_value + line_total WHERE id = grn_id;
        INSERT INTO stock_movements (movement_type, reference_type, reference_id, raw_material_id, warehouse_id, quantity, unit, batch_number, movement_date, notes)
        VALUES ('receipt', 'multi_branch_seed', grn_id, rm_rec.id, rm_wh_id, qty, 'kg', 'DEMO-' || to_char(receipt_date, 'YYYYMMDD'), receipt_date + time '08:00', 'Demo multi-branch seed receipt');
      END LOOP;

      -- issues/consumption
      FOR rm_rec IN SELECT id FROM raw_materials WHERE code LIKE branch_code || '-RM-%' LOOP
        qty := 1600 + random() * 600;
        INSERT INTO stock_movements (movement_type, reference_type, reference_id, raw_material_id, warehouse_id, quantity, unit, batch_number, movement_date, notes)
        VALUES ('production_input', 'multi_branch_seed', NULL, rm_rec.id, rm_wh_id, qty, 'kg', 'DEMO-ISS-' || to_char(issue_date, 'YYYYMMDD'), issue_date + time '09:00', 'Demo multi-branch usage');
      END LOOP;

      -- production order
      form_id := form_ids[((extract(month FROM month_cursor)::int + length(branch_code)) % array_length(form_ids, 1)) + 1];
      INSERT INTO production_orders (
        batch_number, plan_id, formulation_id, machine_id, planned_qty, actual_qty, rejected_qty, wastage_qty, unit, status, priority,
        planned_start, planned_end, actual_start, actual_end, operator_id, supervisor_id,
        raw_material_cost, labour_cost, machine_cost, overhead_cost, total_cost, cost_per_unit, notes, created_at, updated_at
      )
      VALUES (
        format('DEMO-%s-PRD-%s', branch_code, to_char(month_cursor, 'YYYYMM')),
        NULL,
        form_id,
        machine_id,
        60 + random() * 20,
        56 + random() * 18,
        1 + random() * 2,
        0.5 + random(),
        't',
        'completed',
        'normal',
        issue_date + time '06:00',
        issue_date + time '18:00',
        issue_date + time '06:30',
        issue_date + time '17:30',
        NULL,
        NULL,
        20000 + random() * 4000,
        2500 + random() * 900,
        1100 + random() * 500,
        950 + random() * 400,
        25000 + random() * 5000,
        430 + random() * 25,
        'Demo seeded production order',
        issue_date + time '18:10',
        issue_date + time '18:10'
      )
      RETURNING id INTO prod_id;

      -- dispatch order
      INSERT INTO dispatch_orders (
        dispatch_number, branch_id, warehouse_id, dispatch_date, status, vehicle_number, driver_name,
        total_weight, total_value, prepared_by, approved_by, delivery_notes, created_at, updated_at
      )
      VALUES (
        format('DEMO-%s-DISP-%s', branch_code, to_char(month_cursor, 'YYYYMM')),
        branch_id,
        fg_wh_id,
        month_cursor + INTERVAL '15 days',
        'delivered',
        branch_code || '-TRK',
        branch_name || ' Driver',
        25000 + random() * 4000,
        420000 + random() * 40000,
        NULL,
        NULL,
        'Demo seeded dispatch',
        month_cursor + INTERVAL '15 days',
        month_cursor + INTERVAL '15 days'
      )
      RETURNING id INTO dispatch_id;

      -- reconciliation period
      INSERT INTO reconciliation_periods (
        month, year, branch_id, status,
        received_raw_materials_t, transferred_rm_to_prod_t, exp_production_via_bulks_t,
        exp_production_via_macropacks_t, exp_production_via_packaging_t,
        actual_declared_production_t, transferred_prod_to_dispatch_t,
        expected_dispatched_t, actual_dispatched_t, notes
      )
      VALUES (
        EXTRACT(MONTH FROM month_cursor)::int,
        EXTRACT(YEAR FROM month_cursor)::int,
        branch_id,
        'completed',
        130 + random() * 30,
        120 + random() * 25,
        90 + random() * 20,
        30 + random() * 10,
        25 + random() * 8,
        118 + random() * 18,
        110 + random() * 15,
        105 + random() * 12,
        103 + random() * 10,
        'Demo seeded period for ' || branch_code
      )
      RETURNING id INTO recon_period_id;

      -- recon raw materials (two entries)
      FOR rm_rec IN SELECT id, name FROM raw_materials WHERE code LIKE branch_code || '-RM-%' ORDER BY code LIMIT 2 LOOP
        INSERT INTO recon_raw_materials (
          period_id, material_type, material_name, raw_material_id,
          opening_stock, stock_receipts, total, issues,
          physical_stock, system_stock, material_variance, variance_pct, comments
        )
        VALUES (
          recon_period_id,
          CASE WHEN rm_rec.name ILIKE '%Protein%' THEN 'minivits' ELSE 'bulk' END,
          rm_rec.name,
          rm_rec.id,
          40 + random() * 10,
          30 + random() * 10,
          70 + random() * 10,
          60 + random() * 8,
          12 + random() * 4,
          11 + random() * 4,
          1 + random() * 2,
          2 + random() * 2,
          'Demo seeded RM'
        );
      END LOOP;

      -- recon production (bulk + packaging)
      INSERT INTO recon_production (
        period_id, production_type, product_name, formulation_id,
        opening_stock, stock_received, total, expected_production,
        conversion_produced, wastage, closing_stock, physical_stock, system_stock,
        material_variance, variance_pct, bag_size_kg, expected_bags, physical_bags, system_bags,
        bag_variance, bag_variance_pct, comments
      )
      VALUES (
        recon_period_id,
        'bulk',
        'Bulk Base Mix',
        form_ids[1],
        30 + random() * 10,
        60 + random() * 10,
        90 + random() * 15,
        85 + random() * 10,
        82 + random() * 10,
        2 + random(),
        40 + random() * 8,
        38 + random() * 6,
        37 + random() * 6,
        1 + random() * 2,
        2 + random(),
        50,
        1800 + random() * 200,
        1750 + random() * 200,
        1720 + random() * 200,
        30 + random() * 25,
        2 + random() * 2,
        'Demo seeded production'
      );

      INSERT INTO recon_production (
        period_id, production_type, product_name, formulation_id,
        opening_stock, stock_received, total, expected_production,
        conversion_produced, wastage, closing_stock, physical_stock, system_stock,
        material_variance, variance_pct, bag_size_kg, expected_bags, physical_bags, system_bags,
        bag_variance, bag_variance_pct, comments
      )
      VALUES (
        recon_period_id,
        'packaging',
        'Packaging Line',
        form_ids[2],
        15 + random() * 6,
        55 + random() * 10,
        70 + random() * 12,
        68 + random() * 8,
        65 + random() * 8,
        1 + random(),
        28 + random() * 6,
        27 + random() * 6,
        26 + random() * 6,
        1 + random(),
        3 + random(),
        25,
        2400 + random() * 300,
        2350 + random() * 250,
        2300 + random() * 250,
        50 + random() * 40,
        2 + random(),
        'Demo seeded production'
      );

      -- macropacks + usage
      rm_for_usage := (SELECT id FROM raw_materials WHERE code LIKE branch_code || '-RM-%' ORDER BY code LIMIT 1);
      FOR i IN 1..2 LOOP
        INSERT INTO recon_macropacks (
          period_id, macropack_name, formulation_id, opening_stock, manufactured_units,
          total_units, converted_units, closing_stock, system_units, material_variance,
          variance_pct, comments
        )
        VALUES (
          recon_period_id,
          format('%s Macro %s', branch_code, i),
          form_ids[3],
          400 + random() * 80,
          200 + random() * 60,
          600 + random() * 90,
          380 + random() * 70,
          180 + random() * 40,
          175 + random() * 40,
          5 + random() * 5,
          2 + random() * 2,
          'Demo seeded macropack'
        )
        RETURNING id INTO macropack_id;

        INSERT INTO recon_macropack_usage (recon_macropack_id, ingredient_name, raw_material_id, quantity_used, unit)
        VALUES (macropack_id, 'Demo Ingredient', rm_for_usage, 120 + random() * 20, 'kg');
      END LOOP;

      -- finished goods
      INSERT INTO recon_finished_goods (
        period_id, product_name, formulation_id, opening_stock, receipt_from_production,
        total, dispatched, closing_stock, physical_stock, system_stock,
        material_variance, variance_pct, bag_size_kg, dispatched_bags, physical_bags, system_bags,
        bag_variance, bag_variance_pct, comments
      )
      VALUES (
        recon_period_id,
        'Demo Finished Bulk',
        form_ids[1],
        25 + random() * 8,
        80 + random() * 10,
        105 + random() * 12,
        70 + random() * 10,
        35 + random() * 6,
        34 + random() * 6,
        33 + random() * 6,
        1 + random() * 2,
        2 + random(),
        50,
        1900 + random() * 200,
        1880 + random() * 200,
        1860 + random() * 200,
        20 + random() * 15,
        1 + random(),
        'Demo seeded FG'
      );

      INSERT INTO recon_finished_goods (
        period_id, product_name, formulation_id, opening_stock, receipt_from_production,
        total, dispatched, closing_stock, physical_stock, system_stock,
        material_variance, variance_pct, bag_size_kg, dispatched_bags, physical_bags, system_bags,
        bag_variance, bag_variance_pct, comments
      )
      VALUES (
        recon_period_id,
        'Demo Finished Packaged',
        form_ids[2],
        18 + random() * 5,
        65 + random() * 8,
        83 + random() * 10,
        62 + random() * 8,
        21 + random() * 5,
        20 + random() * 5,
        19 + random() * 5,
        1 + random(),
        3 + random(),
        25,
        2300 + random() * 250,
        2275 + random() * 230,
        2255 + random() * 230,
        20 + random() * 18,
        1 + random(),
        'Demo seeded FG'
      );

      -- observations
      observation_severity := CASE WHEN random() > 0.7 THEN 'critical' WHEN random() > 0.4 THEN 'warning' ELSE 'info' END;
      INSERT INTO recon_observations (period_id, section, observation, severity)
      VALUES (
        recon_period_id,
        'statistics',
        format('Demo seeded observation for %s (%s)', branch_code, to_char(month_cursor, 'Mon YYYY')),
        observation_severity
      );

      month_cursor := (month_cursor + INTERVAL '1 month')::date;
    END LOOP;
  END LOOP;
END $$;
