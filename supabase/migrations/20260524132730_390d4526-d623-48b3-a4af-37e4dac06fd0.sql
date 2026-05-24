
CREATE OR REPLACE FUNCTION public.handle_appointment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hours_notice numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'no-show' AND NEW.appointment_type::text = 'weekly_refresh' THEN
      UPDATE public.perks_usage
      SET status = 'forfeited', used_date = CURRENT_DATE
      WHERE related_appointment_id = NEW.id AND status = 'available';
    END IF;

    IF NEW.status::text = 'cancelled' THEN
      hours_notice := EXTRACT(EPOCH FROM ((NEW.scheduled_date + NEW.scheduled_time) - now())) / 3600.0;
      IF hours_notice >= 24 THEN
        UPDATE public.perks_usage
        SET status = 'available', used_date = NULL
        WHERE related_appointment_id = NEW.id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
