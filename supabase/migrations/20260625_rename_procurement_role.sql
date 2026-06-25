-- Rename Procurement role to Raw Materials/Procurement
UPDATE roles 
SET name = 'Raw Materials/Procurement',
    description = 'Raw materials and procurement management - GRN first approval'
WHERE code = 'procurement';
