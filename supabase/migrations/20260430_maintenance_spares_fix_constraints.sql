-- Fix maintenance_spares check constraints to include all values from seed data

-- Drop and recreate sub_group check constraint with all values
ALTER TABLE maintenance_spares DROP CONSTRAINT IF EXISTS maintenance_spares_sub_group_check;
ALTER TABLE maintenance_spares 
ADD CONSTRAINT maintenance_spares_sub_group_check 
CHECK (sub_group IN ('Pelletiser', 'Dog Extruder', 'Full Fat Extruder', 'Hammer Mill', 'Elevator', 'Compressor', 'Boiler', 'Red Plant', 'Conveyor', 'Mixer', 'Crumpler', 'Rotary Feeder', 'Pneumatic Cylinders', 'Drives', 'Forklift', 'General', 'Extruder', 'Powder Cleaners', 'Cooler', 'Augers', 'Pneumatics & Valves', 'Blocks Plant'));

-- Also update category check constraint to include 'Electrical' (from seed data)
ALTER TABLE maintenance_spares DROP CONSTRAINT IF EXISTS maintenance_spares_category_check;
ALTER TABLE maintenance_spares 
ADD CONSTRAINT maintenance_spares_category_check 
CHECK (category IN ('Bearings', 'V-Belts', 'Oil Seals', 'Die Parts', 'Cylinders', 'Drives', 'Chains', 'Electrical', 'Lubricants', 'Filters', 'Rolls & Rods', 'Elevator Belts', 'Misc'));
