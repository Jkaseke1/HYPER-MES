-- Simple fix: Check existing users and create test user
-- This works with the profiles table structure

-- Option 1: Check what users you already have
SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Option 2: Create a test user profile (if you don't have one)
INSERT INTO profiles (email, full_name, role)
VALUES ('admin@hyperfeeds.com', 'Admin User', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Option 3: Create a test operator user
INSERT INTO profiles (email, full_name, role)
VALUES ('operator@hyperfeeds.com', 'Operator User', 'operator')
ON CONFLICT (email) DO NOTHING;

-- After running this, try logging in with:
-- Email: admin@hyperfeeds.com
-- Password: password123 (or whatever you set)
