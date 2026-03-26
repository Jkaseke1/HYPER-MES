-- Seed data for Plant Maintenance Module
-- Run this after the multi-branch seed script

DO $$
DECLARE
  branch_rec RECORD;
  machine_rec RECORD;
  wh_id uuid;
  supplier_id uuid;
  part_id uuid;
  schedule_id uuid;
  wo_id uuid;
  user_id uuid;
  part_ids uuid[];
  schedule_ids uuid[];
  wo_counter integer := 1;
BEGIN
  -- Cleanup existing maintenance demo data
  DELETE FROM equipment_downtime_log WHERE machine_id IN (SELECT id FROM machines WHERE code LIKE 'DEMO-%');
  DELETE FROM spare_parts_usage WHERE work_order_id IN (SELECT id FROM maintenance_work_orders WHERE wo_number LIKE 'WO-%');
  DELETE FROM maintenance_tasks WHERE work_order_id IN (SELECT id FROM maintenance_work_orders WHERE wo_number LIKE 'WO-%');
  DELETE FROM maintenance_work_orders WHERE wo_number LIKE 'WO-%';
  DELETE FROM maintenance_schedules WHERE schedule_code LIKE 'DEMO-%';
  DELETE FROM spare_parts WHERE code LIKE 'DEMO-%';

  -- Get a supplier
  SELECT id INTO supplier_id FROM suppliers WHERE code = 'DEMO-SUP-001' LIMIT 1;
  
  -- Get a user for assignments
  SELECT id INTO user_id FROM profiles LIMIT 1;

  -- Create spare parts for each branch's warehouse
  FOR branch_rec IN SELECT id, code, name FROM branches WHERE code LIKE 'DEMO-BR%' LOOP
    -- Get the RM warehouse for this branch
    SELECT id INTO wh_id FROM warehouses 
    WHERE branch_id = branch_rec.id AND type = 'raw_material' 
    LIMIT 1;

    -- Mechanical parts
    INSERT INTO spare_parts (code, name, description, category, unit, unit_cost, currency_code, reorder_level, current_stock, warehouse_id, supplier_id, lead_time_days, is_critical, is_active)
    VALUES 
      (branch_rec.code || '-SP-001', 'Mixer Blade Set', 'Replacement blades for feed mixer', 'mechanical', 'set', 450.00, 'USD', 2, 5, wh_id, supplier_id, 14, true, true),
      (branch_rec.code || '-SP-002', 'Drive Belt V-Type', 'V-belt for main drive motor', 'mechanical', 'pcs', 85.00, 'USD', 3, 8, wh_id, supplier_id, 7, true, true),
      (branch_rec.code || '-SP-003', 'Bearing 6208', 'Deep groove ball bearing', 'mechanical', 'pcs', 35.00, 'USD', 4, 12, wh_id, supplier_id, 7, false, true),
      (branch_rec.code || '-SP-004', 'Shaft Seal Kit', 'Complete seal kit for main shaft', 'mechanical', 'kit', 120.00, 'USD', 2, 4, wh_id, supplier_id, 10, true, true);

    -- Electrical parts
    INSERT INTO spare_parts (code, name, description, category, unit, unit_cost, currency_code, reorder_level, current_stock, warehouse_id, supplier_id, lead_time_days, is_critical, is_active)
    VALUES 
      (branch_rec.code || '-SP-005', 'Motor Contactor 25A', 'Main motor contactor', 'electrical', 'pcs', 95.00, 'USD', 2, 6, wh_id, supplier_id, 7, true, true),
      (branch_rec.code || '-SP-006', 'Proximity Sensor', 'Inductive proximity sensor', 'electrical', 'pcs', 45.00, 'USD', 3, 10, wh_id, supplier_id, 7, false, true),
      (branch_rec.code || '-SP-007', 'Control Relay 24VDC', 'Control circuit relay', 'electrical', 'pcs', 25.00, 'USD', 5, 15, wh_id, supplier_id, 5, false, true);

    -- Consumables
    INSERT INTO spare_parts (code, name, description, category, unit, unit_cost, currency_code, reorder_level, current_stock, warehouse_id, supplier_id, lead_time_days, is_critical, is_active)
    VALUES 
      (branch_rec.code || '-SP-008', 'Air Filter Element', 'Compressor air filter', 'consumable', 'pcs', 18.00, 'USD', 5, 20, wh_id, supplier_id, 5, false, true),
      (branch_rec.code || '-SP-009', 'Hydraulic Oil ISO 46', 'Hydraulic system oil', 'lubricant', 'liters', 12.00, 'USD', 50, 200, wh_id, supplier_id, 7, false, true),
      (branch_rec.code || '-SP-010', 'Grease NLGI 2', 'Multi-purpose lithium grease', 'lubricant', 'kg', 8.00, 'USD', 20, 80, wh_id, supplier_id, 5, false, true);

    -- Create low stock scenario for some parts
    UPDATE spare_parts SET current_stock = 1 
    WHERE code IN (branch_rec.code || '-SP-001', branch_rec.code || '-SP-004')
    AND warehouse_id = wh_id;

  END LOOP;

  -- Create maintenance schedules for each machine
  FOR machine_rec IN SELECT id, code, name FROM machines WHERE code LIKE 'DEMO-%' LOOP
    
    -- Weekly lubrication
    INSERT INTO maintenance_schedules (schedule_code, machine_id, title, description, maintenance_type, frequency_type, frequency_value, estimated_duration_minutes, next_due_date, assigned_to, priority, is_active)
    VALUES (
      machine_rec.code || '-SCH-001',
      machine_rec.id,
      'Weekly Lubrication',
      'Lubricate all grease points and check oil levels',
      'lubrication',
      'weekly',
      1,
      30,
      CURRENT_DATE + INTERVAL '3 days',
      user_id,
      'medium',
      true
    ) RETURNING id INTO schedule_id;

    -- Monthly inspection
    INSERT INTO maintenance_schedules (schedule_code, machine_id, title, description, maintenance_type, frequency_type, frequency_value, estimated_duration_minutes, next_due_date, assigned_to, priority, is_active)
    VALUES (
      machine_rec.code || '-SCH-002',
      machine_rec.id,
      'Monthly Safety Inspection',
      'Check guards, emergency stops, safety interlocks',
      'inspection',
      'monthly',
      1,
      60,
      CURRENT_DATE + INTERVAL '10 days',
      user_id,
      'high',
      true
    ) RETURNING id INTO schedule_id;

    -- Quarterly preventive maintenance
    INSERT INTO maintenance_schedules (schedule_code, machine_id, title, description, maintenance_type, frequency_type, frequency_value, estimated_duration_minutes, next_due_date, assigned_to, priority, is_active)
    VALUES (
      machine_rec.code || '-SCH-003',
      machine_rec.id,
      'Quarterly PM - Drive System',
      'Inspect belts, bearings, alignment. Replace worn parts.',
      'preventive',
      'quarterly',
      1,
      120,
      CURRENT_DATE + INTERVAL '45 days',
      user_id,
      'high',
      true
    ) RETURNING id INTO schedule_id;

    -- Create some overdue schedules
    INSERT INTO maintenance_schedules (schedule_code, machine_id, title, description, maintenance_type, frequency_type, frequency_value, estimated_duration_minutes, next_due_date, assigned_to, priority, is_active)
    VALUES (
      machine_rec.code || '-SCH-004',
      machine_rec.id,
      'Blade Sharpness Check',
      'Inspect mixer blades for wear and sharpness',
      'inspection',
      'monthly',
      1,
      45,
      CURRENT_DATE - INTERVAL '5 days',
      user_id,
      'medium',
      true
    ) RETURNING id INTO schedule_id;

  END LOOP;

  -- Create work orders (mix of preventive, corrective, and breakdown)
  FOR machine_rec IN SELECT id, code, name FROM machines WHERE code LIKE 'DEMO-%' LIMIT 5 LOOP
    
    -- Completed preventive maintenance
    INSERT INTO maintenance_work_orders (
      wo_number, machine_id, work_type, priority, status, title, description,
      reported_by, assigned_to, scheduled_date, started_at, completed_at,
      estimated_duration_minutes, actual_duration_minutes, downtime_minutes,
      production_impact_qty, labor_cost, parts_cost, total_cost, notes
    ) VALUES (
      'WO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(wo_counter::text, 5, '0'),
      machine_rec.id,
      'preventive',
      'medium',
      'completed',
      'Monthly PM - Lubrication & Inspection',
      'Completed monthly preventive maintenance',
      user_id,
      user_id,
      CURRENT_DATE - INTERVAL '10 days',
      (CURRENT_DATE - INTERVAL '10 days') + time '08:00',
      (CURRENT_DATE - INTERVAL '10 days') + time '09:30',
      60,
      90,
      0,
      0,
      150.00,
      45.00,
      195.00,
      'All grease points serviced. Replaced air filter.'
    ) RETURNING id INTO wo_id;
    wo_counter := wo_counter + 1;

    -- Add spare parts usage
    SELECT id INTO part_id FROM spare_parts WHERE code LIKE machine_rec.code || '%' AND category = 'consumable' LIMIT 1;
    IF part_id IS NOT NULL THEN
      INSERT INTO spare_parts_usage (work_order_id, spare_part_id, quantity_used, unit_cost, line_total)
      VALUES (wo_id, part_id, 1, 18.00, 18.00);
    END IF;

    -- Open corrective work order
    INSERT INTO maintenance_work_orders (
      wo_number, machine_id, work_type, priority, status, title, description,
      reported_by, assigned_to, scheduled_date, estimated_duration_minutes, downtime_minutes,
      production_impact_qty, labor_cost, parts_cost, total_cost, notes
    ) VALUES (
      'WO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(wo_counter::text, 5, '0'),
      machine_rec.id,
      'corrective',
      'high',
      'assigned',
      'Unusual Vibration - Drive Belt',
      'Operators reported excessive vibration during operation',
      user_id,
      user_id,
      CURRENT_DATE + INTERVAL '1 day',
      120,
      0,
      0,
      0,
      0,
      0,
      'Scheduled for tomorrow morning. Suspect worn drive belt.'
    );
    wo_counter := wo_counter + 1;

    -- In-progress breakdown
    INSERT INTO maintenance_work_orders (
      wo_number, machine_id, work_type, priority, status, title, description,
      reported_by, assigned_to, scheduled_date, started_at, estimated_duration_minutes,
      downtime_minutes, production_impact_qty, labor_cost, parts_cost, total_cost, notes
    ) VALUES (
      'WO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(wo_counter::text, 5, '0'),
      machine_rec.id,
      'breakdown',
      'critical',
      'in_progress',
      'Emergency Stop Not Resetting',
      'E-stop button stuck, machine cannot restart',
      user_id,
      user_id,
      CURRENT_DATE,
      CURRENT_DATE + time '10:30',
      180,
      120,
      500,
      0,
      0,
      0,
      'Technician on site. Investigating control circuit.'
    ) RETURNING id INTO wo_id;
    wo_counter := wo_counter + 1;

    -- Log downtime
    INSERT INTO equipment_downtime_log (
      machine_id, work_order_id, downtime_type, started_at, ended_at, duration_minutes,
      planned_output_qty, actual_output_qty, output_loss_qty, description, reported_by
    ) VALUES (
      machine_rec.id,
      wo_id,
      'breakdown',
      CURRENT_DATE + time '10:30',
      NULL,
      NULL,
      2000,
      0,
      2000,
      'Emergency stop malfunction - production halted',
      user_id
    );

  END LOOP;

  RAISE NOTICE 'Maintenance seed data created successfully';
END $$;
