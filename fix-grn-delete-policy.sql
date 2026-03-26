-- =====================================================
-- FIX GRN DELETE POLICY WITH ROLE-BASED ACCESS CONTROL
-- Only admin and warehouse_manager can delete GRNs
-- This prevents accidental deletion of important records
-- =====================================================

-- Add DELETE policy for GRN (restricted to admin and warehouse_manager)
CREATE POLICY "Only admin and warehouse_manager can delete grn"
  ON goods_received_notes FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'warehouse_manager')
    )
  );

-- Add DELETE policy for GRN items (restricted to admin and warehouse_manager)
CREATE POLICY "Only admin and warehouse_manager can delete grn items"
  ON grn_items FOR DELETE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = (select auth.uid()) 
      AND profiles.role IN ('admin', 'warehouse_manager')
    )
  );

-- Verify policies exist
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('goods_received_notes', 'grn_items')
ORDER BY tablename, cmd;

-- =====================================================
-- ROLE-BASED ACCESS CONTROL SUMMARY
-- =====================================================
-- WHO CAN DELETE GRNs:
-- ✅ admin - Full system access
-- ✅ warehouse_manager - Manages warehouse operations
-- ❌ warehouse_clerk - Can create but not delete
-- ❌ supervisor - Can view and approve
-- ❌ operator - Limited access
-- ❌ finance - Read-only for GRNs
--
-- This ensures GRNs are protected from accidental deletion
-- while allowing authorized personnel to manage records.
-- =====================================================
