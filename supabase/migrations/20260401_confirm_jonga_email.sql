-- Confirm email for jonga@hyperfeeds.co.zw user
-- This script marks the user's email as confirmed in the auth system

UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'jonga@hyperfeeds.co.zw'
AND email_confirmed_at IS NULL;

-- Verify the update
SELECT id, email, email_confirmed_at, confirmed_at
FROM auth.users
WHERE email = 'jonga@hyperfeeds.co.zw';
