-- Create admin user directly by inserting into auth.users and profiles
-- This bypasses the trigger that might be causing issues

-- First, let's check if a user already exists
SELECT id, email, raw_user_meta_data FROM auth.users WHERE email = 'admin@hyperfeeds.com';

-- If no user exists, you'll need to create one through the Supabase Dashboard UI
-- But if a user exists and just needs the profile, run this:

-- Insert profile for existing user (if user was created but profile failed)
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Admin User'), 'admin'
FROM auth.users
WHERE email = 'admin@hyperfeeds.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = 'Admin User';

-- Verify the profile was created
SELECT p.id, p.email, p.full_name, p.role, p.created_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'admin@hyperfeeds.com';
