CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Ensure the search_path of the security-definer functions can find crypt/gen_salt
ALTER FUNCTION public.verify_staff_pin(text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.change_staff_pin(uuid, text) SET search_path = public, extensions;
ALTER FUNCTION public.admin_reset_pin(uuid, uuid, text) SET search_path = public, extensions;