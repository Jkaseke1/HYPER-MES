-- Fixed version: No ON CONFLICT since there's no unique constraint on email

-- Check what users you already have
SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Create a test user profile (simple insert)
INSERT INTO profiles (email, full_name, role)
VALUES ('admin@hyperfeeds.com', 'Admin User', 'admin');

-- Create a test operator user (simple insert)
INSERT INTO profiles (email, full_name, role)
VALUES ('operator@hyperfeeds.com', 'Operator User', 'operator');

-- Note: If you get "duplicate key" error, it means the user already exists
-- That's actually fine - just try logging in with existing credentials
