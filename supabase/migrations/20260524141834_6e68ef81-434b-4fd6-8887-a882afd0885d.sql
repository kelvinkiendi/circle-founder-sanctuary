
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add new role values
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'reception' AND enumtypid = 'staff_role'::regtype) THEN
    ALTER TYPE staff_role ADD VALUE 'reception';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'guardian' AND enumtypid = 'staff_role'::regtype) THEN
    ALTER TYPE staff_role ADD VALUE 'guardian';
  END IF;
END $$;

-- Extend staff
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT true;

-- Migrate existing plaintext pins to hashed (best-effort)
UPDATE public.staff
  SET pin_hash = crypt(pin, gen_salt('bf'))
  WHERE pin IS NOT NULL AND pin_hash IS NULL;

-- Sessions
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  device_label text,
  portal text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff_sessions" ON public.staff_sessions FOR SELECT USING (true);
CREATE POLICY "Public write staff_sessions" ON public.staff_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff_sessions" ON public.staff_sessions FOR UPDATE USING (true);

-- Login log
CREATE TABLE IF NOT EXISTS public.staff_login_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid,
  success boolean NOT NULL,
  ip text,
  user_agent text,
  reason text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_login_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff_login_log" ON public.staff_login_log FOR SELECT USING (true);
CREATE POLICY "Public write staff_login_log" ON public.staff_login_log FOR INSERT WITH CHECK (true);

-- Seed default admin if none exists
INSERT INTO public.staff (full_name, role, pin_hash, active, must_change_pin, status)
SELECT 'Sanctuary Admin', 'admin'::staff_role, crypt('0000', gen_salt('bf')), true, true, 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.staff WHERE role = 'admin'::staff_role);

-- Verify PIN RPC: returns session info or null. Handles lockout.
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_pin text, p_device text DEFAULT NULL, p_user_agent text DEFAULT NULL)
RETURNS TABLE(session_id uuid, staff_id uuid, full_name text, role staff_role, must_change_pin boolean, last_login_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s record;
  new_sid uuid;
BEGIN
  -- Find matching staff by hashed pin
  SELECT * INTO s FROM public.staff
   WHERE pin_hash IS NOT NULL
     AND active = true
     AND status = 'active'
     AND pin_hash = crypt(p_pin, pin_hash)
   LIMIT 1;

  IF s.id IS NULL THEN
    INSERT INTO public.staff_login_log (success, user_agent, reason) VALUES (false, p_user_agent, 'invalid_pin');
    RETURN;
  END IF;

  -- Check lockout
  IF s.locked_until IS NOT NULL AND s.locked_until > now() THEN
    INSERT INTO public.staff_login_log (staff_id, success, user_agent, reason)
    VALUES (s.id, false, p_user_agent, 'locked');
    RETURN;
  END IF;

  -- Success: reset counters, create session
  UPDATE public.staff
    SET failed_attempts = 0, locked_until = NULL, last_login_at = now()
    WHERE id = s.id;

  INSERT INTO public.staff_sessions (staff_id, device_label)
    VALUES (s.id, p_device) RETURNING id INTO new_sid;

  INSERT INTO public.staff_login_log (staff_id, success, user_agent) VALUES (s.id, true, p_user_agent);

  RETURN QUERY SELECT new_sid, s.id, s.full_name, s.role, s.must_change_pin, s.last_login_at;
END;
$$;

-- Record a failed PIN attempt against a known staff_id (admin can call after detecting brute force on a known account)
CREATE OR REPLACE FUNCTION public.record_failed_pin(p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- best-effort: we cannot know which account, so just log it
  INSERT INTO public.staff_login_log (success, reason) VALUES (false, 'invalid_pin');
END; $$;

-- Validate a session id and return staff info
CREATE OR REPLACE FUNCTION public.get_staff_session(p_session uuid)
RETURNS TABLE(session_id uuid, staff_id uuid, full_name text, role staff_role, must_change_pin boolean, last_login_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff_sessions SET last_active_at = now()
    WHERE id = p_session AND ended_at IS NULL;
  RETURN QUERY
    SELECT ss.id, s.id, s.full_name, s.role, s.must_change_pin, s.last_login_at
    FROM public.staff_sessions ss
    JOIN public.staff s ON s.id = ss.staff_id
    WHERE ss.id = p_session AND ss.ended_at IS NULL AND s.active = true;
END; $$;

CREATE OR REPLACE FUNCTION public.end_staff_session(p_session uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.staff_sessions SET ended_at = now() WHERE id = p_session;
END; $$;

CREATE OR REPLACE FUNCTION public.change_staff_pin(p_session uuid, p_new_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
  SELECT staff_id INTO sid FROM public.staff_sessions WHERE id = p_session AND ended_at IS NULL;
  IF sid IS NULL THEN RETURN false; END IF;
  IF p_new_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  UPDATE public.staff SET pin_hash = crypt(p_new_pin, gen_salt('bf')), must_change_pin = false WHERE id = sid;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reset_pin(p_admin_session uuid, p_staff_id uuid, p_new_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r staff_role;
BEGIN
  SELECT s.role INTO r FROM public.staff_sessions ss
    JOIN public.staff s ON s.id = ss.staff_id
    WHERE ss.id = p_admin_session AND ss.ended_at IS NULL;
  IF r IS DISTINCT FROM 'admin'::staff_role THEN RETURN false; END IF;
  IF p_new_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  UPDATE public.staff
    SET pin_hash = crypt(p_new_pin, gen_salt('bf')),
        must_change_pin = true,
        failed_attempts = 0,
        locked_until = NULL
    WHERE id = p_staff_id;
  RETURN true;
END; $$;
