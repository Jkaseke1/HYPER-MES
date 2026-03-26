-- Fix RLS policies for admin access
-- Drop existing policies and recreate them properly

-- Drop existing user_roles policies
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;

-- Create new user_roles policies
CREATE POLICY "Users can view own roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all user roles" ON user_roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can insert all user roles" ON user_roles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can update all user roles" ON user_roles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can delete all user roles" ON user_roles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

-- Drop existing user_branch_access policies
DROP POLICY IF EXISTS "Users can view own branch access" ON user_branch_access;
DROP POLICY IF EXISTS "Admins can manage all branch access" ON user_branch_access;

-- Create new user_branch_access policies
CREATE POLICY "Users can view own branch access" ON user_branch_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all branch access" ON user_branch_access
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can insert all branch access" ON user_branch_access
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can update all branch access" ON user_branch_access
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );

CREATE POLICY "Admins can delete all branch access" ON user_branch_access
  FOR DELETE USING (
    EXISTS (
      SELECT 1 
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() 
      AND r.code = 'admin'
    )
  );
