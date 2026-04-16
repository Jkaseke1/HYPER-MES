-- GRN Improvements: File attachments storage bucket + RLS policies

-- Create storage bucket for GRN attachments (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grn-attachments',
  'grn-attachments',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Users can upload files to grn-attachments bucket
CREATE POLICY "Users can upload GRN attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'grn-attachments'
  AND auth.role() = 'authenticated'
);

-- RLS Policy: Users can view files in grn-attachments bucket
CREATE POLICY "Users can view GRN attachments"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'grn-attachments'
  AND auth.role() = 'authenticated'
);

-- RLS Policy: Users can delete their own GRN attachments
CREATE POLICY "Users can delete their own GRN attachments"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'grn-attachments'
  AND auth.uid() = owner
);
