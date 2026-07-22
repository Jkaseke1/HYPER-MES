-- Allow accountant role to update sage_posting_reviews (package approve/reject)
DROP POLICY IF EXISTS "Finance and admin can update posting reviews" ON sage_posting_reviews;

CREATE POLICY "Finance and admin can update posting reviews"
  ON sage_posting_reviews FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('finance', 'accountant', 'admin')
    )
  );
