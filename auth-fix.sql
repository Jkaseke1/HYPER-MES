-- Simple fix: Just disable email confirmation requirement
-- This doesn't require auth.users table access

-- Option 1: Update existing users to mark them as confirmed
UPDATE profiles 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- Option 2: Check if your user exists and what's their status
SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Option 3: If you need to create a test user, create just the profile
-- (auth user will be created when they first log in)
INSERT INTO profiles (email, full_name, role)
VALUES ('test@hyperfeeds.com', 'Test User', 'admin')
ON CONFLICT (email) DO NOTHING;
