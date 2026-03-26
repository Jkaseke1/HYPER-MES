-- Demo seed script: generates ~6 months of activity data for dashboards/forecasts
-- Run once via `supabase db execute < file.sql` or the SQL editor.

DO $$
DECLARE
  demo_branch_id uuid;
  rm_wh_id uuid;
  fg_wh_id uuid;
  machine_id uuid;
  formulation_ids uuid[] := ARRAY[]::uuid[];
  rm_ids uuid[] := ARRAY[]::uuid[];
  start_date date := (CURRENT_DATE - INTERVAL '180 days')::date;
  day_cursor date;
  weekly_cursor date;
  monthly_cursor date;
  rm_id uuid;
  form_id uuid;
  order_counter int := 0;
  dispatch_counter int := 0;
  qty numeric;
BEGIN
  -- Ensure branch
  INSERT INTO branches (name, code, address, contact_person, phone, is_active)
  VALUES ('Demo Branch', 'DEMO-BRANCH', 'Demo Industrial Park', 'Demo Manager', '000-000-0000', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO demo_branch_id;
  IF demo_branch_id IS NULL THEN
    SELECT id INTO demo_branch_id FROM branches WHERE code = 'DEMO-BRANCH' LIMIT 1;
  END IF;

  -- Ensure warehouses
  INSERT INTO warehouses (name, code, type, branch_id, location, is_active)
  VALUES ('Demo Raw Warehouse', 'DEMO-RM-WH', 'raw_material', demo_branch_id, 'Demo Park', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO rm_wh_id;
  IF rm_wh_id IS NULL THEN
    SELECT id INTO rm_wh_id FROM warehouses WHERE code = 'DEMO-RM-WH' LIMIT 1;
  END IF;

  INSERT INTO warehouses (name, code, type, branch_id, location, is_active)
  VALUES ('Demo FG Warehouse', 'DEMO-FG-WH', 'finished_goods', demo_branch_id, 'Demo Park', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO fg_wh_id;
  IF fg_wh_id IS NULL THEN
    SELECT id INTO fg_wh_id FROM warehouses WHERE code = 'DEMO-FG-WH' LIMIT 1;
  END IF;

  -- Ensure machine
  INSERT INTO machines (name, code, type, capacity_per_hour, capacity_unit, status, is_active)
  VALUES ('Demo Mixer', 'DEMO-MX-01', 'mixer', 12, 't', 'operational', true)
  ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO machine_id;
  IF machine_id IS NULL THEN
    SELECT id INTO machine_id FROM machines WHERE code = 'DEMO-MX-01' LIMIT 1;
  END IF;

  -- Seed formulations
  FOR form_row IN SELECT * FROM (
    VALUES
      ('DEMO-FORM-STARTER', 'Starter Feed', 'starter formula'),
      ('DEMO-FORM-FINISHER', 'Finisher Feed', 'finisher formula')
  ) AS f(code, name, description)
  LOOP
    INSERT INTO formulations (name, code, version, category, description, batch_size, batch_unit, target_protein, target_fat, target_fiber, target_moisture, estimated_cost_per_unit, status)
    VALUES (form_row.name, form_row.code, 1, 'feed', form_row.description, 50, 't', 22, 6, 3, 12, 450, 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO form_id;
    IF form_id IS NULL THEN
      SELECT id INTO form_id FROM formulations WHERE code = form_row.code LIMIT 1;
    END IF;
    formulation_ids := array_append(formulation_ids, form_id);
  END LOOP;

  -- Seed raw materials (3 demo items)
  FOR rm_row IN SELECT * FROM (
    VALUES
      ('DEMO-RM-01', 'Fortified Maize', 'grain', 0.32, 5000, 22000),
      ('DEMO-RM-02', 'Soybean Meal', 'protein', 0.48, 3500, 15000),
      ('DEMO-RM-03', 'Vitamin Premix', 'vitamin', 1.20, 800, 3000)
  ) AS rm(code, name, category, cost, reorder_level, current_stock)
  LOOP
    INSERT INTO raw_materials (name, code, category, unit, cost_per_unit, currency_code, cost_per_unit_usd, reorder_level, current_stock, warehouse_id, description, is_active, alert_threshold_pct, days_of_cover_target, alert_channels)
    VALUES (rm.name, rm.code, rm.category, 'kg', rm.cost, 'USD', rm.cost, rm.reorder_level, rm.current_stock, rm_wh_id, 'Demo seed material', true, 0.15, 10, ARRAY['dashboard'])
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO rm_id;
    IF rm_id IS NULL THEN
      SELECT id INTO rm_id FROM raw_materials WHERE code = rm.code LIMIT 1;
    END IF;
    rm_ids := array_append(rm_ids, rm_id);
  END LOOP;

  -- Daily raw material consumption / issues for last 180 days
  day_cursor := start_date;
  WHILE day_cursor <= CURRENT_DATE LOOP
    FOREACH rm_id IN ARRAY rm_ids LOOP
      qty := 200 + (random() * 150);
      INSERT INTO stock_movements (movement_type, reference_type, reference_id, raw_material_id, formulation_id, warehouse_id, quantity, unit, batch_number, movement_date, notes)
      VALUES ('production_input', 'demo_seed', NULL, rm_id, NULL, rm_wh_id, qty, 'kg', 'SEED-' || to_char(day_cursor, 'YYYYMMDD'), day_cursor + time '08:00', 'Demo seed consumption');
    END LOOP;
    day_cursor := day_cursor + 1;
  END LOOP;

  -- Weekly production orders (completed)
  weekly_cursor := start_date;
  WHILE weekly_cursor <= CURRENT_DATE LOOP
    order_counter := order_counter + 1;
    form_id := formulation_ids[(order_counter % array_length(formulation_ids, 1)) + 1];
    INSERT INTO production_orders (
      batch_number, plan_id, formulation_id, machine_id, planned_qty, actual_qty, rejected_qty, wastage_qty, unit, status, priority,
      planned_start, planned_end, actual_start, actual_end, operator_id, supervisor_id,
      raw_material_cost, labour_cost, machine_cost, overhead_cost, total_cost, cost_per_unit, notes, created_at, updated_at
    )
    VALUES (
      'SEED-BATCH-' || to_char(weekly_cursor, 'IYYYIW'),
      NULL,
      form_id,
      machine_id,
      60 + (random() * 20),
      55 + (random() * 18),
      1 + random() * 2,
      0.5 + random(),
      't',
      'completed',
      'normal',
      weekly_cursor + time '06:00',
      weekly_cursor + time '18:00',
      weekly_cursor + time '07:00',
      weekly_cursor + time '17:30',
      NULL,
      NULL,
      18000 + random() * 4000,
      2300 + random() * 800,
      1200 + random() * 500,
      900 + random() * 400,
      23000 + random() * 5000,
      420 + random() * 30,
      'Demo seeded order',
      weekly_cursor + time '18:05',
      weekly_cursor + time '18:05'
    );
    weekly_cursor := weekly_cursor + 7;
  END LOOP;

  -- Monthly dispatch orders
  monthly_cursor := date_trunc('month', start_date);
  WHILE monthly_cursor <= CURRENT_DATE LOOP
    dispatch_counter := dispatch_counter + 1;
    INSERT INTO dispatch_orders (
      dispatch_number, branch_id, warehouse_id, dispatch_date, status, vehicle_number, driver_name,
      total_weight, total_value, delivery_notes, created_at, updated_at
    )
    VALUES (
      'DEMO-DISP-' || to_char(monthly_cursor, 'YYYYMM'),
      demo_branch_id,
      fg_wh_id,
      monthly_cursor + interval '3 days',
      'delivered',
      'DEM-' || dispatch_counter::text,
      'Demo Driver ' || dispatch_counter::text,
      28000 + random() * 3000,
      480000 + random() * 30000,
      'Demo seeded dispatch',
      monthly_cursor + interval '3 days',
      monthly_cursor + interval '3 days'
    );
    monthly_cursor := monthly_cursor + INTERVAL '1 month';
  END LOOP;
END $$;
