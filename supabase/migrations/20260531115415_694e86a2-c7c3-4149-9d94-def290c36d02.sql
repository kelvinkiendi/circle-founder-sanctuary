-- Restrict sensitive RPC execution to trusted server-side code only.
-- The app calls these through server functions using the service role after validating staff sessions/roles.

REVOKE ALL ON FUNCTION public.set_staff_pin(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_pin(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_staff_pin(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.end_staff_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_staff_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_staff_pin(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_failed_pin(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.suspend_overdue_founders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_staff_earnings_for_payment(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.set_staff_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_pin(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_staff_pin(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.end_staff_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_staff_session(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_failed_pin(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.suspend_overdue_founders() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_staff_earnings_for_payment(uuid) TO service_role;