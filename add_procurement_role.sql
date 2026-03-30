-- Add Procurement Role to MES
-- This script creates a new Procurement role with specific permissions

-- First, check if procurement permissions exist, if not create them
-- (These should already exist in the system, but we'll verify)

-- Create the Procurement role
INSERT INTO roles (
    code,
    name,
    description,
    is_system,
    is_active
) VALUES (
    'procurement',
    'Procurement',
    'Procurement role with access to raw materials, goods received, quality inspection, and material transfer',
    false,
    true
) ON CONFLICT (code) DO NOTHING;

-- Get the procurement role ID
DO $$
DECLARE
    procurement_role_id UUID;
BEGIN
    SELECT id INTO procurement_role_id FROM roles WHERE code = 'procurement';
    
    -- Delete any existing permissions for procurement role to start fresh
    DELETE FROM role_permissions WHERE role_id = procurement_role_id;
    
    -- Add Raw Materials permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code IN ('raw_materials.view', 'raw_materials.create', 'raw_materials.edit', 'raw_materials.delete')
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
    
    -- Add Goods Received permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code IN ('grn.view', 'grn.create', 'grn.approve', 'grn.delete')
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
    
    -- Add Quality Inspection permissions
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code IN ('quality.view', 'quality.create', 'quality.approve')
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
    
    -- Add Material Transfer permissions (warehouse.transfer)
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code IN ('warehouse.view', 'warehouse.transfer')
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
    
    -- Add basic dashboard access
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code = 'dashboard.view'
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
    
    -- Add basic reports access
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT procurement_role_id, id 
    FROM permissions 
    WHERE code IN ('reports.view', 'reports.export')
    AND NOT EXISTS (
        SELECT 1 FROM role_permissions rp 
        WHERE rp.role_id = procurement_role_id AND rp.permission_id = permissions.id
    );
END $$;

-- Verify the role was created with correct permissions
SELECT 
    r.code as role_code,
    r.name as role_name,
    r.description,
    COUNT(rp.permission_id) as permission_count,
    STRING_AGG(p.code, ', ' ORDER BY p.code) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
LEFT JOIN permissions p ON rp.permission_id = p.id
WHERE r.code = 'procurement'
GROUP BY r.code, r.name, r.description;

-- Show what permissions the procurement role has
SELECT 
    p.module,
    p.code,
    p.name,
    p.description
FROM permissions p
JOIN role_permissions rp ON p.id = rp.permission_id
JOIN roles r ON rp.role_id = r.id
WHERE r.code = 'procurement'
ORDER BY p.module, p.code;
