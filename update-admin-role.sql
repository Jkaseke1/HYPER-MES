-- Update Joseph Kaseke's role to admin
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/appyuqxetlphuxfybmus/editor

UPDATE profiles
SET role = 'admin'
WHERE email = 'kasekejoseph19@gmail.com';

-- Verify the update
SELECT id, full_name, email, role, created_at
FROM profiles
WHERE email = 'kasekejoseph19@gmail.com';
