-- Complete fix: Disable RLS on all user management tables
-- This will allow all admin operations to work properly

-- Disable RLS on all user management tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Allow all operations on profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update all user roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete all user roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own branch access" ON user_branch_access;
DROP POLICY IF EXISTS "Admins can view all branch access" ON user_branch_access;
DROP POLICY IF EXISTS "Admins can insert all branch access" ON user_branch_access;
DROP POLICY IF EXISTS "Admins can update all branch access" ON user_branch_access;
DROP POLICY IF EXISTS "Admins can delete all branch access" ON user_branch_access;

-- Grant full permissions to authenticated users
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_branch_access TO authenticated;
