-- Populate percentage column from quantity data
-- BOM was seeded from Sage with quantities per 50kg bag
-- Calculate percentage: (quantity / 50.0) * 100

UPDATE formulation_ingredients fi
SET percentage = ROUND((fi.quantity / 50.0) * 100, 4)
WHERE fi.percentage = 0 AND fi.quantity > 0;
