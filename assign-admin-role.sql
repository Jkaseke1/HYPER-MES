-- Run this in Supabase SQL Editor to assign admin role to your user
-- Replace 'your-email@example.com' with your actual email

-- First, find your user ID
SELECT id, email, full_name FROM profiles;

-- Then assign admin role (replace USER_ID with your actual user ID from above)
-- INSERT INTO user_roles (user_id, role_id)
-- SELECT 'YOUR_USER_ID_HERE', id FROM roles WHERE code = 'admin';

-- Or assign admin to ALL existing users (for testing)
INSERT INTO user_roles (user_id, role_id)
SELECT p.id, r.id 
FROM profiles p
CROSS JOIN roles r 
WHERE r.code = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
