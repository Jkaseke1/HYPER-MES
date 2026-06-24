-- Check the current definition of pending_approvals view
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE viewname = 'pending_approvals'
AND schemaname = 'public';

-- Also check what columns it uses
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'pending_approvals'
ORDER BY ordinal_position;
