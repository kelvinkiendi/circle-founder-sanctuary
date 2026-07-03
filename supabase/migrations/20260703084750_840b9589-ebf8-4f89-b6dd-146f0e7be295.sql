-- Restore service_role privileges on all public tables and sequences.
-- The prior lockdown revoked grants from every role including service_role,
-- which caused "permission denied" errors even inside supabaseAdmin server functions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO service_role', r.sequence_name);
  END LOOP;
END $$;

-- Ensure service_role can execute RPC helpers used by server functions.
GRANT EXECUTE ON FUNCTION public.get_staff_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_staff_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_staff_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_pin(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_staff_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_staff_earnings_for_payment(uuid) TO service_role;