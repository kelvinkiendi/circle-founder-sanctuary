
-- Track who created each client + per-client reminder cadence override
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS reminder_interval_days integer;

CREATE INDEX IF NOT EXISTS idx_clients_created_by ON public.clients(created_by);

-- Update visit-date sync trigger to use per-client cadence, then global default, then 21
CREATE OR REPLACE FUNCTION public.sync_client_visit_dates()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_client uuid;
  latest_date date;
  days_interval integer;
  global_days integer;
BEGIN
  target_client := COALESCE(NEW.client_id, OLD.client_id);
  IF target_client IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT MAX(scheduled_date) INTO latest_date
  FROM public.appointments
  WHERE client_id = target_client
    AND status IN ('booked','completed');

  SELECT reminder_interval_days INTO days_interval FROM public.clients WHERE id = target_client;
  IF days_interval IS NULL THEN
    SELECT NULLIF(value->>'days','')::int INTO global_days
      FROM public.app_settings WHERE key = 'visit_reminder';
    days_interval := COALESCE(global_days, 21);
  END IF;

  UPDATE public.clients
     SET last_appointment_date = latest_date,
         next_visit_predicted_date = CASE WHEN latest_date IS NOT NULL
              THEN latest_date + (days_interval || ' days')::interval
              ELSE NULL END
   WHERE id = target_client;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
