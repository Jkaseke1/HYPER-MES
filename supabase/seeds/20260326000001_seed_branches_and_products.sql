-- Seed script for Hyperfeeds Nutrition branches and products
-- Based on actual company data

-- Insert Branches
INSERT INTO branches (name, code, location, contact_person, contact_phone, contact_email, is_active, created_at) VALUES
('Amtec', 'AMT', 'Amtec', NULL, NULL, NULL, true, NOW()),
('Bulawayo', 'BYO', 'Bulawayo', NULL, NULL, NULL, true, NOW()),
('Chigovanyika', 'CGV', 'Chigovanyika', NULL, NULL, NULL, true, NOW()),
('Chikanga', 'CHK', 'Chikanga', NULL, NULL, NULL, true, NOW()),
('Chiredzi', 'CHR', 'Chiredzi', NULL, NULL, NULL, true, NOW()),
('Dangamvura', 'DGM', 'Dangamvura', NULL, NULL, NULL, true, NOW()),
('Domboshava Main', 'DOM', 'Domboshava Main', NULL, NULL, NULL, true, NOW()),
('Domboshava Market', 'DMK', 'Domboshava Market', NULL, NULL, NULL, true, NOW()),
('Epworth', 'EPW', 'Epworth', NULL, NULL, NULL, true, NOW()),
('Factory - DEB', 'DEB', 'Factory - DEB', NULL, NULL, NULL, true, NOW()),
('Factory Shop', 'FSH', 'Factory Shop', NULL, NULL, NULL, true, NOW()),
('Glendale', 'GLD', 'Glendale', NULL, NULL, NULL, true, NOW()),
('Gweru', 'GWR', 'Gweru', NULL, NULL, NULL, true, NOW()),
('Hatcliffe', 'HTC', 'Hatcliffe', NULL, NULL, NULL, true, NOW()),
('Kaguvi', 'KGV', 'Kaguvi', NULL, NULL, NULL, true, NOW()),
('Makoni', 'MKN', 'Makoni', NULL, NULL, NULL, true, NOW()),
('Marondera', 'MRD', 'Marondera', NULL, NULL, NULL, true, NOW()),
('Masvingo', 'MSV', 'Masvingo', NULL, NULL, NULL, true, NOW()),
('Mbudzi Round', 'MBR', 'Mbudzi Round', NULL, NULL, NULL, true, NOW()),
('Msasa', 'MSA', 'Msasa', NULL, NULL, NULL, true, NOW()),
('Mutare', 'MTR', 'Mutare', NULL, NULL, NULL, true, NOW()),
('Ngezi', 'NGZ', 'Ngezi', NULL, NULL, NULL, true, NOW()),
('Show Grounds', 'SHG', 'Show Grounds', NULL, NULL, NULL, true, NOW()),
('Siyaso Mazorodze', 'SYM', 'Siyaso Mazorodze', NULL, NULL, NULL, true, NOW()),
('Southwinds', 'STW', 'Southwinds', NULL, NULL, NULL, true, NOW()),
('Zvishavane', 'ZVS', 'Zvishavane', NULL, NULL, NULL, true, NOW())
ON CONFLICT (code) DO NOTHING;

-- Get branch IDs for reference
DO $$
DECLARE
  factory_branch_id UUID;
BEGIN
  SELECT id INTO factory_branch_id FROM branches WHERE code = 'DEB' LIMIT 1;

  -- Insert Formulations (Products)
  INSERT INTO formulations (name, code, description, target_weight, unit, status, cost_per_unit, selling_price, category, created_at) VALUES
  ('Broiler Starter Crumbs', 'BSC50', 'Broiler Starter Crumbs 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('PIG GROWER MEAL', 'PGM50', 'PIG GROWER MEAL 50KG', 50, 'kg', 'active', 0, 0, 'pig', NOW()),
  ('Broiler Grower Pellet', 'BGP50', 'Broiler Grower Pellet 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Grower/Finisher', 'BGF50', 'Broiler Grower/Finisher 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Finisher Pellets', 'BFP50', 'Broiler Finisher Pellets 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Lyr In Prdctn Mash', 'LPM50', 'Lyr In Prdctn Mash 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Hyper Dairy Meal', 'HDM50', 'Hyper Dairy Meal 50kg', 50, 'kg', 'active', 0, 0, 'dairy', NOW()),
  ('Pig Grower/Finisher Concentrate', 'PGFC50', 'Pig Grower/Finisher Concentrate 50kg', 50, 'kg', 'active', 0, 0, 'pig', NOW()),
  ('Pig Dry Boar/Sow Meal', 'PDBSM50', 'Pig Dry Boar/Sow Meal 50kg', 50, 'kg', 'active', 0, 0, 'pig', NOW()),
  ('Beef Survival Meal', 'BSM50', 'Beef Survival Meal 50kg', 50, 'kg', 'active', 0, 0, 'beef', NOW()),
  ('Broiler Starter/Grower', 'BSG50', 'Broiler Starter/Grower 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Pig Creep/Weaner Meal', 'PCWM50', 'Pig Creep/Weaner Meal 50kg', 50, 'kg', 'active', 0, 0, 'pig', NOW()),
  ('Broiler Grower Crumbs', 'BGC50', 'Broiler Grower Crumbs 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Layer Developer Mash', 'LDM50', 'Layer Developer Mash 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Layer Chick Starter Mash', 'LCSM50', 'Layer Chick Starter Mash 50kg', 50, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Hyper Dog Chunks', 'HDC10', 'Hyper Dog Chunks 10kg', 10, 'kg', 'active', 0, 0, 'pet', NOW()),
  ('Broiler Starter Crumbs', 'BSC25', 'Broiler Starter Crumbs 25kg', 25, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('CALF STARTER MEAL', 'CSM50', 'CALF STARTER MEAL 50kg', 50, 'kg', 'active', 0, 0, 'dairy', NOW()),
  ('Beef Fattening Meal', 'BFM50', 'Beef Fattening Meal 50kg', 50, 'kg', 'active', 0, 0, 'beef', NOW()),
  ('Broiler Grower Pellets', 'BGP25', 'Broiler Grower Pellets 25kg', 25, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Beef Survival Meal', 'BSM40', 'Beef Survival Meal 40kg', 40, 'kg', 'active', 0, 0, 'beef', NOW()),
  ('Broiler Finisher Pellets', 'BFP25', 'Broiler Finisher Pellets 25kg', 25, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Hyper Dog Chunks', 'HDC5', 'Hyper Dog Chunks 5kg', 5, 'kg', 'active', 0, 0, 'pet', NOW()),
  ('Bull Heifer Meal', 'BHM50', 'Bull Heifer Meal 50kg', 50, 'kg', 'active', 0, 0, 'beef', NOW()),
  ('CALF GROWER MEAL', 'CGM50', 'CALF GROWER MEAL 50kg', 50, 'kg', 'active', 0, 0, 'dairy', NOW()),
  ('Rabbit Pellets', 'RBP50', 'Rabbit Pellets 50kg', 50, 'kg', 'active', 0, 0, 'rabbit', NOW()),
  ('Broiler Starter/Grower', 'BSG25', 'Broiler Starter/Grower 25kg', 25, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Starter Crumbs', 'BSC10', 'Broiler Starter Crumbs 10kg', 10, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Dry Cow Meal Far Off', 'DCMFO50', 'Dry Cow Meal Far Off 50kg', 50, 'kg', 'active', 0, 0, 'dairy', NOW()),
  ('Hyper Dog Chunks', 'HDC08', 'Hyper Dog Chunks 8kg', 8, 'kg', 'active', 0, 0, 'pet', NOW()),
  ('Broiler Grower/Finisher', 'BGF25', 'Broiler Grower/Finisher 25kg', 25, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Finisher Pellets', 'BFP10', 'Broiler Finisher Pellets 10kg', 10, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Rabbit Pellets', 'RBP25', 'Rabbit Pellets 25kg', 25, 'kg', 'active', 0, 0, 'rabbit', NOW()),
  ('Rabbit Pellets', 'RBP10', 'Rabbit Pellets 10kg', 10, 'kg', 'active', 0, 0, 'rabbit', NOW()),
  ('Broiler Grower Pellets', 'BGP05', 'Broiler Grower Pellets 5kg', 5, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Starter Crumbs', 'BSC05', 'Broiler Starter Crumbs 5kg', 5, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Broiler Finisher Pellets', 'BFP05', 'Broiler Finisher Pellets 5kg', 5, 'kg', 'active', 0, 0, 'poultry', NOW()),
  ('Rabbit Pellets', 'RBP05', 'Rabbit Pellets 5kg', 5, 'kg', 'active', 0, 0, 'rabbit', NOW())
  ON CONFLICT (code) DO NOTHING;

END $$;

-- Create sample sales orders based on WhatsApp data
DO $$
DECLARE
  glendale_branch_id UUID;
  gweru_branch_id UUID;
  chigovanyika_branch_id UUID;
BEGIN
  SELECT id INTO glendale_branch_id FROM branches WHERE code = 'GLD' LIMIT 1;
  SELECT id INTO gweru_branch_id FROM branches WHERE code = 'GWR' LIMIT 1;
  SELECT id INTO chigovanyika_branch_id FROM branches WHERE code = 'CGV' LIMIT 1;

  -- Glendale 8ton Order (from WhatsApp)
  IF glendale_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date, 
      expected_delivery_date, total_tonnage, total_value, status, priority, 
      notes, branch_id, created_at
    ) VALUES (
      'SO-GLD-001', 'Glendale Farm', 'Glendale', CURRENT_DATE - INTERVAL '2 days',
      CURRENT_DATE + INTERVAL '4 days', 8.0, 0, 'pending', 'normal',
      'Expected 30 March 2026. Includes chemicals and equipment.', glendale_branch_id, NOW()
    );
  END IF;

  -- Gweru 30tn Order (from WhatsApp)
  IF gweru_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date,
      expected_delivery_date, total_tonnage, total_value, status, priority,
      notes, branch_id, created_at
    ) VALUES (
      'SO-GWR-001', 'Gweru Distributors', 'Gweru', CURRENT_DATE - INTERVAL '1 day',
      CURRENT_DATE + INTERVAL '5 days', 30.0, 0, 'confirmed', 'urgent',
      'Large order - 30 tons mixed products', gweru_branch_id, NOW()
    );
  END IF;

  -- Chigovanyika Order (from WhatsApp)
  IF chigovanyika_branch_id IS NOT NULL THEN
    INSERT INTO sales_orders (
      order_number, customer_name, customer_location, order_date,
      expected_delivery_date, total_tonnage, total_value, status, priority,
      notes, branch_id, created_at
    ) VALUES (
      'SO-CGV-001', 'Chigovanyika Shop', 'Chigovanyika', CURRENT_DATE,
      CURRENT_DATE + INTERVAL '3 days', 3.75, 0, 'pending', 'normal',
      'Daily target 3.75t, Sold 0.77t', chigovanyika_branch_id, NOW()
    );
  END IF;

END $$;

-- Create sample daily production reports
DO $$
DECLARE
  factory_branch_id UUID;
BEGIN
  SELECT id INTO factory_branch_id FROM branches WHERE code = 'DEB' LIMIT 1;

  IF factory_branch_id IS NOT NULL THEN
    -- Day shift - Main Plant
    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      downtime_hours, downtime_reason, created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Main Plant', 'Mixed Production',
      6.25, 0, 0, 0, 'no_production', 10,
      '1. Attending to boiler elements; 4hrs, 2. Power outage; 6hrs', NOW()
    );

    -- Day shift - Dog Plant
    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Dog Plant', 'Hyper Dog Chunks',
      NULL, 1.525, NULL, 4, 'completed', NOW()
    );

    -- Day shift - Samurai 7 Mix
    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'day', 'B/N 071326', 'Samurai Plant', 'BFAM',
      NULL, 4.0, NULL, 4, 'completed', NOW()
    );

    -- Night shift - No production
    INSERT INTO daily_production_reports (
      report_date, branch_id, shift, batch_number, plant_name, product_name,
      daily_target, quantity_produced, quantity_sold, labour_force, status,
      downtime_hours, downtime_reason, created_at
    ) VALUES (
      CURRENT_DATE, factory_branch_id, 'night', 'B/N 091326', 'Main Plant', 'No Production',
      NULL, 0, 0, 0, 'no_production', 12,
      'Power outage - mainline fault; reference number 32600003', NOW()
    );
  END IF;

END $$;

-- Create production issue log for power outage
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
    );
  END IF;

END $$;
