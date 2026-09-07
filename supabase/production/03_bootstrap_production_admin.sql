-- Assign the first Production administrator after its Auth user has been created.
-- This affects only admin@hyperfeeds.com and contains no password material.

DO $$
DECLARE
  admin_user_id uuid;
  admin_role_id uuid;
BEGIN
  SELECT id INTO admin_user_id
  FROM public.profiles
  WHERE lower(email) = 'admin@hyperfeeds.com';

  IF admin_user_id IS NULL THEN
    RAISE EXCEPTION 'The Production profile for admin@hyperfeeds.com was not created. Stop and investigate the auth profile trigger.';
  END IF;

  SELECT id INTO admin_role_id
  FROM public.roles
  WHERE code = 'admin' AND is_active = true;

  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'The active admin role is missing. Stop and investigate the role bootstrap.';
  END IF;

  UPDATE public.profiles
  SET full_name = 'Admin',
      role = 'admin',
      updated_at = now()
  WHERE id = admin_user_id;

  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (admin_user_id, admin_role_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;
END $$;

SELECT
  p.full_name,
  p.email,
  p.role,
  r.code AS assigned_role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
JOIN public.roles r ON r.id = ur.role_id
WHERE lower(p.email) = 'admin@hyperfeeds.com';
