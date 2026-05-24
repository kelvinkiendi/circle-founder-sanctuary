
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS last_appointment_date date,
  ADD COLUMN IF NOT EXISTS next_visit_predicted_date date;

WITH latest AS (
  SELECT client_id, MAX(scheduled_date) AS last_date
  FROM public.appointments
  WHERE status IN ('booked','completed')
  GROUP BY client_id
)
UPDATE public.clients c
SET last_appointment_date = latest.last_date,
    next_visit_predicted_date = latest.last_date + INTERVAL '21 days'
FROM latest
WHERE c.id = latest.client_id;

CREATE OR REPLACE FUNCTION public.sync_client_visit_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_client uuid;
  latest_date date;
BEGIN
  target_client := COALESCE(NEW.client_id, OLD.client_id);
  IF target_client IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT MAX(scheduled_date) INTO latest_date
  FROM public.appointments
  WHERE client_id = target_client
    AND status IN ('booked','completed');

  UPDATE public.clients
     SET last_appointment_date = latest_date,
         next_visit_predicted_date = CASE WHEN latest_date IS NOT NULL THEN latest_date + INTERVAL '21 days' ELSE NULL END
   WHERE id = target_client;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_client_visit_dates ON public.appointments;
CREATE TRIGGER trg_sync_client_visit_dates
AFTER INSERT OR UPDATE OR DELETE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_client_visit_dates();
