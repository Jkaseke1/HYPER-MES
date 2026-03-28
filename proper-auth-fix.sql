-- Proper fix: Create auth user first, then profile
-- This follows the correct Supabase pattern

-- Step 1: Check if you already have users
SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Step 2: Use the Supabase Dashboard instead of SQL
-- Go to: Supabase Dashboard → Authentication → Users → Add User
-- Create:
-- - Email: admin@hyperfeeds.com  
-- - Password: password123
-- - ✅ Check "Auto-confirm user"

-- Step 3: After creating auth user, create the profile with the correct ID
-- (You'll need to get the actual UUID from the auth.users table)

-- For now, let's just check what auth users exist:
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Then you can create the profile with the correct ID:
-- INSERT INTO profiles (id, email, full_name, role)
-- VALUES ('the-actual-uuid-from-auth-users', 'admin@hyperfeeds.com', 'Admin User', 'admin');
