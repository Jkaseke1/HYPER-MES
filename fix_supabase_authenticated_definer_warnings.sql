-- ==============================================================================
-- SUPABASE SECURITY LINTER WARNING FIX (PART 3 - CORRECTED)
-- Resolves: authenticated_security_definer_function_executable
-- Converts all SECURITY DEFINER functions to SECURITY INVOKER
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT p.oid::regprocedure AS func_signature
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.prosecdef = true
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER;', r.func_signature);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not set SECURITY INVOKER on %: %', r.func_signature, SQLERRM;
        END;
    END LOOP;
END $$;
