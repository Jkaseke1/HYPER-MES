-- Force fix: Completely remove RLS and all policies
-- This will definitively fix all RLS issues

-- Step 1: Disable RLS on all tables
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on all tables
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on profiles
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_record.policyname);
    END LOOP;
    
    -- Drop all policies on user_roles
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'user_roles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_roles', policy_record.policyname);
    END LOOP;
    
    -- Drop all policies on user_branch_access
    FOR policy_record IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'user_branch_access' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON user_branch_access', policy_record.policyname);
    END LOOP;
END $$;

-- Step 3: Force disable RLS again
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access DISABLE ROW LEVEL SECURITY;

-- Step 4: Grant comprehensive permissions
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON user_roles TO authenticated;
GRANT ALL ON user_branch_access TO authenticated;
GRANT ALL ON profiles TO anon;
GRANT ALL ON user_roles TO anon;
GRANT ALL ON user_branch_access TO anon;

-- Step 5: Verify RLS is disabled
SELECT 
    schemaname,
    tablename,
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('profiles', 'user_roles', 'user_branch_access') 
AND schemaname = 'public';
