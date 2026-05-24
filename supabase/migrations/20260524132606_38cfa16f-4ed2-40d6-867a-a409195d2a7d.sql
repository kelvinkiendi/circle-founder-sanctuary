
-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id uuid,
  kind text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "Public write notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Public delete notifications" ON public.notifications FOR DELETE USING (true);

-- Product access windows (founder prelaunch)
CREATE TABLE IF NOT EXISTS public.product_access_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_access_windows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_access_windows" ON public.product_access_windows FOR SELECT USING (true);
CREATE POLICY "Public write product_access_windows" ON public.product_access_windows FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update product_access_windows" ON public.product_access_windows FOR UPDATE USING (true);
CREATE POLICY "Public delete product_access_windows" ON public.product_access_windows FOR DELETE USING (true);

-- Trigger: appointment status change -> perk forfeit/restore
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
    -- No-show on weekly refresh -> forfeit linked perk
    IF NEW.status::text = 'no_show' AND NEW.appointment_type::text = 'weekly_refresh' THEN
      UPDATE public.perks_usage
      SET status = 'forfeited', used_date = CURRENT_DATE
      WHERE related_appointment_id = NEW.id AND status = 'available';
    END IF;

    -- Cancellation with 24h+ notice -> restore perk
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

DROP TRIGGER IF EXISTS trg_appointment_status ON public.appointments;
CREATE TRIGGER trg_appointment_status
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.handle_appointment_status_change();

-- Trigger: founder term ending -> notification
CREATE OR REPLACE FUNCTION public.handle_founder_term_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days_left integer;
BEGIN
  IF NEW.term_end_date IS NOT NULL AND NEW.status::text = 'active' THEN
    days_left := (NEW.term_end_date - CURRENT_DATE);
    IF days_left <= 30 AND days_left >= 0 THEN
      INSERT INTO public.notifications (founder_id, kind, message)
      SELECT NEW.id, 'term_expiring', 'Founder term ends in ' || days_left || ' days'
      WHERE NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE founder_id = NEW.id AND kind = 'term_expiring'
          AND created_at > now() - interval '7 days'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_founder_term_check ON public.founder_circle;
CREATE TRIGGER trg_founder_term_check
AFTER INSERT OR UPDATE ON public.founder_circle
FOR EACH ROW EXECUTE FUNCTION public.handle_founder_term_check();

-- Trigger: new prelaunch product -> 14-day founder window
CREATE OR REPLACE FUNCTION public.handle_product_prelaunch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.launch_status::text = 'prelaunch' THEN
    INSERT INTO public.product_access_windows (product_id, opens_at, closes_at)
    VALUES (NEW.id, now(), now() + interval '14 days');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_prelaunch ON public.products;
CREATE TRIGGER trg_product_prelaunch
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.handle_product_prelaunch();
