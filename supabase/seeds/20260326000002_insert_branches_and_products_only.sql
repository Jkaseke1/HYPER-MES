-- Insert only branches and products data (no schema changes)
-- Run this in Supabase SQL Editor after migration is applied

-- Insert Branches
INSERT INTO branches (name, code, address, is_active) VALUES
('Amtec', 'AMT', 'Amtec', true),
('Bulawayo', 'BYO', 'Bulawayo', true),
('Chigovanyika', 'CGV', 'Chigovanyika', true),
('Chikanga', 'CHK', 'Chikanga', true),
('Chiredzi', 'CHR', 'Chiredzi', true),
('Dangamvura', 'DGM', 'Dangamvura', true),
('Domboshava Main', 'DOM', 'Domboshava Main', true),
('Domboshava Market', 'DMK', 'Domboshava Market', true),
('Epworth', 'EPW', 'Epworth', true),
('Factory - DEB', 'DEB', 'Factory - DEB', true),
('Factory Shop', 'FSH', 'Factory Shop', true),
('Glendale', 'GLD', 'Glendale', true),
('Gweru', 'GWR', 'Gweru', true),
('Hatcliffe', 'HTC', 'Hatcliffe', true),
('Kaguvi', 'KGV', 'Kaguvi', true),
('Makoni', 'MKN', 'Makoni', true),
('Marondera', 'MRD', 'Marondera', true),
('Masvingo', 'MSV', 'Masvingo', true),
('Mbudzi Round', 'MBR', 'Mbudzi Round', true),
('Msasa', 'MSA', 'Msasa', true),
('Mutare', 'MTR', 'Mutare', true),
('Ngezi', 'NGZ', 'Ngezi', true),
('Show Grounds', 'SHG', 'Show Grounds', true),
('Siyaso Mazorodze', 'SYM', 'Siyaso Mazorodze', true),
('Southwinds', 'STW', 'Southwinds', true),
('Zvishavane', 'ZVS', 'Zvishavane', true)
ON CONFLICT (code) DO NOTHING;

-- Insert Formulations (Products)
INSERT INTO formulations (name, code, description, batch_size, batch_unit, status, category) VALUES
('Broiler Starter Crumbs 50kg', 'BSC50', 'Broiler Starter Crumbs 50kg', 50, 'kg', 'active', 'broiler'),
('PIG GROWER MEAL 50KG', 'PGM50', 'PIG GROWER MEAL 50KG', 50, 'kg', 'active', 'pig'),
('Broiler Grower Pellet 50kg', 'BGP50', 'Broiler Grower Pellet 50kg', 50, 'kg', 'active', 'broiler'),
('Broiler Grower/Finisher 50kg', 'BGF50', 'Broiler Grower/Finisher 50kg', 50, 'kg', 'active', 'broiler'),
('Broiler Finisher Pellets 50kg', 'BFP50', 'Broiler Finisher Pellets 50kg', 50, 'kg', 'active', 'broiler'),
('Lyr In Prdctn Mash 50kg', 'LPM50', 'Lyr In Prdctn Mash 50kg', 50, 'kg', 'active', 'layer'),
('Hyper Dairy Meal 50kg', 'HDM50', 'Hyper Dairy Meal 50kg', 50, 'kg', 'active', 'dairy'),
('Pig Grower/Finisher Concentrate 50kg', 'PGFC50', 'Pig Grower/Finisher Concentrate 50kg', 50, 'kg', 'active', 'pig'),
('Pig Dry Boar/Sow Meal 50kg', 'PDBSM50', 'Pig Dry Boar/Sow Meal 50kg', 50, 'kg', 'active', 'pig'),
('Beef Survival Meal 50kg', 'BSM50', 'Beef Survival Meal 50kg', 50, 'kg', 'active', 'other'),
('Broiler Starter/Grower 50kg', 'BSG50', 'Broiler Starter/Grower 50kg', 50, 'kg', 'active', 'broiler'),
('Pig Creep/Weaner Meal 50kg', 'PCWM50', 'Pig Creep/Weaner Meal 50kg', 50, 'kg', 'active', 'pig'),
('Broiler Grower Crumbs 50kg', 'BGC50', 'Broiler Grower Crumbs 50kg', 50, 'kg', 'active', 'broiler'),
('Layer Developer Mash 50kg', 'LDM50', 'Layer Developer Mash 50kg', 50, 'kg', 'active', 'layer'),
('Layer Chick Starter Mash 50kg', 'LCSM50', 'Layer Chick Starter Mash 50kg', 50, 'kg', 'active', 'layer'),
('Hyper Dog Chunks 10kg', 'HDC10', 'Hyper Dog Chunks 10kg', 10, 'kg', 'active', 'pet'),
('Broiler Starter Crumbs 25kg', 'BSC25', 'Broiler Starter Crumbs 25kg', 25, 'kg', 'active', 'broiler'),
('CALF STARTER MEAL 50kg', 'CSM50', 'CALF STARTER MEAL 50kg', 50, 'kg', 'active', 'dairy'),
('Beef Fattening Meal 50kg', 'BFM50', 'Beef Fattening Meal 50kg', 50, 'kg', 'active', 'other'),
('Broiler Grower Pellets 25kg', 'BGP25', 'Broiler Grower Pellets 25kg', 25, 'kg', 'active', 'broiler'),
('Beef Survival Meal 40kg', 'BSM40', 'Beef Survival Meal 40kg', 40, 'kg', 'active', 'other'),
('Broiler Finisher Pellets 25kg', 'BFP25', 'Broiler Finisher Pellets 25kg', 25, 'kg', 'active', 'broiler'),
('Hyper Dog Chunks 5kg', 'HDC5', 'Hyper Dog Chunks 5kg', 5, 'kg', 'active', 'pet'),
('Bull Heifer Meal 50kg', 'BHM50', 'Bull Heifer Meal 50kg', 50, 'kg', 'active', 'other'),
('CALF GROWER MEAL 50kg', 'CGM50', 'CALF GROWER MEAL 50kg', 50, 'kg', 'active', 'dairy'),
('Rabbit Pellets 50kg', 'RBP50', 'Rabbit Pellets 50kg', 50, 'kg', 'active', 'other'),
('Broiler Starter/Grower 25kg', 'BSG25', 'Broiler Starter/Grower 25kg', 25, 'kg', 'active', 'broiler'),
('Broiler Starter Crumbs 10kg', 'BSC10', 'Broiler Starter Crumbs 10kg', 10, 'kg', 'active', 'broiler'),
('Dry Cow Meal Far Off 50kg', 'DCMFO50', 'Dry Cow Meal Far Off 50kg', 50, 'kg', 'active', 'dairy'),
('Hyper Dog Chunks 8kg', 'HDC08', 'Hyper Dog Chunks 8kg', 8, 'kg', 'active', 'pet'),
('Broiler Grower/Finisher 25kg', 'BGF25', 'Broiler Grower/Finisher 25kg', 25, 'kg', 'active', 'broiler'),
('Broiler Finisher Pellets 10kg', 'BFP10', 'Broiler Finisher Pellets 10kg', 10, 'kg', 'active', 'broiler'),
('Rabbit Pellets 25kg', 'RBP25', 'Rabbit Pellets 25kg', 25, 'kg', 'active', 'other'),
('Rabbit Pellets 10kg', 'RBP10', 'Rabbit Pellets 10kg', 10, 'kg', 'active', 'other'),
('Broiler Grower Pellets 5kg', 'BGP05', 'Broiler Grower Pellets 5kg', 5, 'kg', 'active', 'broiler'),
('Broiler Starter Crumbs 5kg', 'BSC05', 'Broiler Starter Crumbs 5kg', 5, 'kg', 'active', 'broiler'),
('Broiler Finisher Pellets 5kg', 'BFP05', 'Broiler Finisher Pellets 5kg', 5, 'kg', 'active', 'broiler'),
('Rabbit Pellets 5kg', 'RBP05', 'Rabbit Pellets 5kg', 5, 'kg', 'active', 'other')
ON CONFLICT (code) DO NOTHING;

-- Sample Sales Orders (from WhatsApp data)
DO $$
DECLARE
  glendale_branch_id UUID;
  gweru_branch_id UUID;
  chigovanyika_branch_id UUID;
BEGIN
  SELECT id INTO glendale_branch_id FROM branches WHERE code = 'GLD' LIMIT 1;
  SELECT id INTO gweru_branch_id FROM branches WHERE code = 'GWR' LIMIT 1;
  SELECT id INTO chigovanyika_branch_id FROM branches WHERE code = 'CGV' LIMIT 1;

  IF glendale_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date, 
      expected_delivery_date, total_tonnage, total_value, status, priority, 
      notes, branch_id, created_at
    ) VALUES (
      'SO-GLD-001', 'Glendale Farm', 'Glendale', CURRENT_DATE - INTERVAL '2 days',
      CURRENT_DATE + INTERVAL '4 days', 8.0, 0, 'pending', 'normal',
      'Expected 30 March 2026. Includes chemicals and equipment.', glendale_branch_id, NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF gweru_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date,
      expected_delivery_date, total_tonnage, total_value, status, priority,
      notes, branch_id, created_at
    ) VALUES (
      'SO-GWR-001', 'Gweru Distributors', 'Gweru', CURRENT_DATE - INTERVAL '1 day',
      CURRENT_DATE + INTERVAL '5 days', 30.0, 0, 'confirmed', 'urgent',
      'Large order - 30 tons mixed products', gweru_branch_id, NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF chigovanyika_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date,
      expected_delivery_date, total_tonnage, total_value, status, priority,
      notes, branch_id, created_at
    ) VALUES (
      'SO-CGV-001', 'Chigovanyika Shop', 'Chigovanyika', CURRENT_DATE,
      CURRENT_DATE + INTERVAL '3 days', 3.75, 0, 'pending', 'normal',
      'Daily target 3.75t, Sold 0.77t', chigovanyika_branch_id, NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Daily Production Reports (from WhatsApp data)
DO $$
DECLARE
  factory_branch_id UUID;
BEGIN
  SELECT id INTO factory_branch_id FROM branches WHERE code = 'DEB' LIMIT 1;

  IF factory_branch_id IS NOT NULL THEN
    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      downtime_hours, downtime_reason, created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Main Plant', 'Mixed Production',
      6.25, 0, 0, 0, 'no_production', 10,
      '1. Attending to boiler elements; 4hrs, 2. Power outage; 6hrs', NOW()
    ) ON CONFLICT DO NOTHING;

    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Dog Plant', 'Hyper Dog Chunks',
      NULL, 1.525, NULL, 4, 'completed', NOW()
    ) ON CONFLICT DO NOTHING;

    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Samurai Plant', 'BFAM',
      NULL, 4.0, NULL, 4, 'completed', NOW()
    ) ON CONFLICT DO NOTHING;

    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      downtime_hours, downtime_reason, created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'night', 'B/N 091326', 'Main Plant', 'No Production',
      NULL, 0, 0, 0, 'no_production', 12,
      'Power outage - mainline fault; reference number 32600003', NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Sample Production Issue
DO $$
DECLARE
  factory_branch_id UUID;
BEGIN
  SELECT id INTO factory_branch_id FROM branches WHERE code = 'DEB' LIMIT 1;

  IF factory_branch_id IS NOT NULL THEN
    INSERT INTO production_issues (
      issue_date, branch_id, shift, issue_type, severity, title, description,
      affected_plant, downtime_hours, created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'power_outage', 'critical',
      'Mainline Power Fault - Ref #32600003',
      'Power outage due to mainline fault. Reference number 32600003. Affected both day and night shifts.',
      'Main Plant, Dog Plant, Samurai Plant', 18, NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
