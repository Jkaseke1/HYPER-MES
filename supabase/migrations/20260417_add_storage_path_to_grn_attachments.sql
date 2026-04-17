-- Add storage_path column to grn_attachments for file downloads
ALTER TABLE grn_attachments
ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- For existing attachments, derive storage_path from file_url if possible
-- The file_url format is: https://appyuqxetlphuxfybmus.supabase.co/storage/v1/object/public/grn-attachments/{grnId}/{timestamp}_{filename}
-- We need to extract the path part after /grn-attachments/
UPDATE grn_attachments
SET storage_path = SUBSTRING(file_url, POSITION('/grn-attachments/' IN file_url) + 16)
WHERE storage_path IS NULL AND file_url LIKE '%/grn-attachments/%';

-- Create index for storage_path lookups
CREATE INDEX IF NOT EXISTS idx_grn_attachments_storage_path ON grn_attachments(storage_path);
