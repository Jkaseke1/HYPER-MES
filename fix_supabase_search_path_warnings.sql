-- ==============================================================================
-- SUPABASE SECURITY LINTER WARNING FIX
-- Resolves: function_search_path_mutable (Function Search Path Mutable)
-- Sets search_path = public, pg_temp on ALL public database functions
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
    LOOP
        BEGIN
            EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', r.func_signature);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not alter function %: %', r.func_signature, SQLERRM;
        END;
    END LOOP;
END $$;
