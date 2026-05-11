-- Seed DRS data for HYPER-MES
-- Snapshot date: 2026-05-11, opening_stock_base_date: 2026-04-29

INSERT INTO rm_daily_snapshots (snapshot_date, raw_material_name, opening_stock, opening_stock_base_date, mtd_receipts, issues_to_production, physical_stock, system_stock)
VALUES
  ('2026-05-11', 'Beef Carcass Meal', 10000, '2026-04-29', 0, 2150, 7850, 0),
  ('2026-05-11', 'Solvent Soya', 0, '2026-04-29', 60500, 60500, 0, 0),
  ('2026-05-11', 'Full Fat Soya Meal', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Low Fat Soya Meal', 8180, '2026-04-29', 2780, 10960, 0, 0),
  ('2026-05-11', 'Soya Beans', 30300, '2026-04-29', 0, 30300, 0, 0),
  ('2026-05-11', 'Cotton Seed', 24332, '2026-04-29', 0, 0, 24332, 0),
  ('2026-05-11', 'Cottonseed Meal', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Sunflower Cake', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Sunflower Meal', 3636.455696, '2026-04-29', 0, 813.42, 2823.037975, 0.002278),
  ('2026-05-11', 'Sunflower Seeds', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Sesame Seeds', 298.8, '2026-04-29', 0, 0, 298.8, 0),
  ('2026-05-11', 'Congluten', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Maize Yellow', 90888, '2026-04-29', 0, 87796, 0, -3092),
  ('2026-05-11', 'Maize White', 0, '2026-04-29', 97305.36, 58617, 38688.36, 0),
  ('2026-05-11', 'Mealie Meal', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Millet', 25150, '2026-04-29', 0, 0, 25150, 0),
  ('2026-05-11', 'Maize Bran', 50938.554021, '2026-04-29', 0, 0, 50938.554021, 0),
  ('2026-05-11', 'Wheat Bran', 0, '2026-04-29', 69020, 34400, 34620, 0),
  ('2026-05-11', 'RICE BRAN', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Sorghum', 5902.258065, '2026-04-29', 0, 2822.82, 3079.44, 0.001935),
  ('2026-05-11', 'Mollases', 30458.38, '2026-04-29', 0, 0, 30458.38, 0),
  ('2026-05-11', 'Hay Bales', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Cotton Hulls', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Cotton cake fuzzy', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Lucerne pellets', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Maltculms', 16620.75, '2026-04-29', 0, 0, 16620.75, 0),
  ('2026-05-11', 'Thin Corn', 36852.895122, '2026-04-29', 0, 0, 36852.895122, 0),
  ('2026-05-11', 'Barley Straw', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Wheat Straw', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Sorghum Straw/Pellets', 0, '2026-04-29', 0, 0, 0, 0),
  ('2026-05-11', 'Limestone flour', 11900, '2026-04-29', 0, 4700, 7200, 0),
  ('2026-05-11', 'Limestone grits', 12900, '2026-04-29', 0, 2150, 10750, 0),
  ('2026-05-11', 'Magnesium Oxide', 1153.7, '2026-04-29', 0, 0, 1153.7, 0),
  ('2026-05-11', 'Mono calcium Phosphate', 3700.21461, '2026-04-29', 0, 1610.78, 2089.431493, -0.003117),
  ('2026-05-11', 'Calcium Oxide', 13025, '2026-04-29', 0, 0, 13025, 0),
  ('2026-05-11', 'Salt Fine', 6137.035, '2026-04-29', 0, 932.87, 5204.17, 0.005),
  ('2026-05-11', 'Salt Course', 5600, '2026-04-29', 0, 0, 5600, 0)
ON CONFLICT (snapshot_date, raw_material_name) DO UPDATE SET
  opening_stock = EXCLUDED.opening_stock,
  opening_stock_base_date = EXCLUDED.opening_stock_base_date,
  mtd_receipts = EXCLUDED.mtd_receipts,
  issues_to_production = EXCLUDED.issues_to_production,
  physical_stock = EXCLUDED.physical_stock,
  system_stock = EXCLUDED.system_stock;

-- Receipts seed
INSERT INTO rm_daily_receipts (receipt_date, raw_material_name, quantity_kg)
VALUES
  ('2026-04-30', 'Low Fat Soya Meal', 2780),
  ('2026-05-01', 'Wheat Bran', 34620),
  ('2026-05-03', 'Solvent Soya', 30280),
  ('2026-05-04', 'Solvent Soya', 30220),
  ('2026-05-05', 'Maize White', 64302),
  ('2026-05-06', 'Maize White', 33003.36)
ON CONFLICT DO NOTHING;

-- Issues seed (May 4)
INSERT INTO rm_daily_issues (issue_date, raw_material_name, quantity_kg)
VALUES
  ('2026-05-04', 'Beef Carcass Meal', 2150),
  ('2026-05-04', 'Solvent Soya', 20136.20),
  ('2026-05-04', 'Low Fat Soya Meal', 10960),
  ('2026-05-04', 'Soya Beans', 18408.87),
  ('2026-05-04', 'Maize Yellow', 71188),
  ('2026-05-04', 'Wheat Bran', 34400),
  ('2026-05-04', 'Sorghum', 2822.82),
  ('2026-05-04', 'Limestone flour', 2750),
  ('2026-05-04', 'Limestone grits', 2150),
  ('2026-05-04', 'Mono calcium Phosphate', 559.33),
  ('2026-05-04', 'Salt Fine', 385.88)
ON CONFLICT DO NOTHING;

-- Issues seed (May 5)
INSERT INTO rm_daily_issues (issue_date, raw_material_name, quantity_kg)
VALUES
  ('2026-05-05', 'Solvent Soya', 10143.80),
  ('2026-05-05', 'Maize Yellow', 16608),
  ('2026-05-05', 'Sunflower Meal', 813.42),
  ('2026-05-05', 'Limestone flour', 200),
  ('2026-05-05', 'Mono calcium Phosphate', 121.26),
  ('2026-05-05', 'Salt Fine', 71.14)
ON CONFLICT DO NOTHING;

-- Issues seed (May 6)
INSERT INTO rm_daily_issues (issue_date, raw_material_name, quantity_kg)
VALUES
  ('2026-05-06', 'Maize White', 20482),
  ('2026-05-06', 'Limestone flour', 950),
  ('2026-05-06', 'Mono calcium Phosphate', 503.50),
  ('2026-05-06', 'Salt Fine', 263.61)
ON CONFLICT DO NOTHING;

-- Issues seed (May 7)
INSERT INTO rm_daily_issues (issue_date, raw_material_name, quantity_kg)
VALUES
  ('2026-05-07', 'Soya Beans', 11891.13),
  ('2026-05-07', 'Maize White', 38135),
  ('2026-05-07', 'Limestone flour', 800),
  ('2026-05-07', 'Mono calcium Phosphate', 426.69),
  ('2026-05-07', 'Salt Fine', 212.24)
ON CONFLICT DO NOTHING;
