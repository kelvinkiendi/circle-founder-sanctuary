-- =========================================================
-- WhatsApp Business API module
-- =========================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  category text NOT NULL DEFAULT 'utility',
  language text NOT NULL DEFAULT 'en',
  body_text text NOT NULL,
  variables_count integer NOT NULL DEFAULT 0,
  variables text[] NOT NULL DEFAULT '{}',
  is_critical boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_name, language)
);

GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_templates_service_only" ON public.whatsapp_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER whatsapp_templates_updated_at BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.whatsapp_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  founder_id uuid REFERENCES public.founder_circle(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  template_name text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_text text,
  status text NOT NULL DEFAULT 'queued',
  meta_message_id text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.whatsapp_logs TO service_role;
ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wa_logs_service_only" ON public.whatsapp_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_wa_logs_client ON public.whatsapp_logs (client_id, template_name, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_logs_status ON public.whatsapp_logs (status, queued_at);
CREATE INDEX IF NOT EXISTS idx_wa_logs_meta_id ON public.whatsapp_logs (meta_message_id);

-- Opt-in + per-category preferences on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_prefs jsonb NOT NULL DEFAULT
    '{"appointments":true,"perks":true,"events":true,"payments":true,"marketing":false}'::jsonb;

-- Existing clients who never opted out are treated as opted in (legacy consent)
UPDATE public.clients SET whatsapp_opt_in = true, whatsapp_opt_in_at = now()
  WHERE whatsapp_opt_out = false AND whatsapp_opt_in = false;

-- ---------------------------------------------------------
-- Seeded templates (English + Swahili)
-- ---------------------------------------------------------
INSERT INTO public.whatsapp_templates (template_name, category, language, body_text, variables_count, variables, is_critical)
VALUES
 ('founder_welcome','onboarding','en','Karibu to Founder Circle, {{name}}! Your Founder No. is {{number}}. Book your first weekly refresh: {{link}}',3,ARRAY['name','number','link'],true),
 ('founder_welcome','onboarding','sw','Karibu Founder Circle, {{name}}! Namba yako ya Founder ni {{number}}. Weka miadi yako ya kwanza: {{link}}',3,ARRAY['name','number','link'],true),
 ('appointment_reminder','appointments','en','Hi {{name}}, your {{service}} is booked for {{date}} at {{time}}. Reply CONFIRM or call {{studio_number}}',5,ARRAY['name','service','date','time','studio_number'],true),
 ('appointment_reminder','appointments','sw','Habari {{name}}, huduma yako ya {{service}} imewekwa tarehe {{date}} saa {{time}}. Jibu CONFIRM au piga {{studio_number}}',5,ARRAY['name','service','date','time','studio_number'],true),
 ('appointment_cancelled','appointments','en','{{name}}, your {{service}} on {{date}} at {{time}} has been cancelled. Reply to rebook. — COTERIE',4,ARRAY['name','service','date','time'],true),
 ('perk_alert','perks','en','Your weekly refresh perk expires in {{days}} days. Book now: {{link}}',2,ARRAY['days','link'],false),
 ('perk_alert','perks','sw','Zawadi yako ya wiki inaisha baada ya siku {{days}}. Weka miadi: {{link}}',2,ARRAY['days','link'],false),
 ('surprise_moment','perks','en','{{name}}, you''ve unlocked a surprise {{perk}}! Valid until {{date}}. See you soon 💅',3,ARRAY['name','perk','date'],false),
 ('payment_confirmation','payments','en','Payment of KSH {{amount}} received. Your Founder Circle membership is active until {{date}}',2,ARRAY['amount','date'],true),
 ('payment_confirmation','payments','sw','Malipo ya KSH {{amount}} yamepokelewa. Uanachama wako wa Founder Circle ni hai hadi {{date}}',2,ARRAY['amount','date'],true),
 ('payment_overdue','payments','en','{{name}}, your Founder Circle balance of KSH {{amount}} is overdue since {{date}}. Pay via M-Pesa Paybill {{paybill}}. — COTERIE',4,ARRAY['name','amount','date','paybill'],true),
 ('brunch_invite','events','en','Exclusive Founder Brunch — {{date}} at {{location}}. RSVP by {{deadline}}: {{link}}',4,ARRAY['date','location','deadline','link'],false),
 ('brunch_invite','events','sw','Founder Brunch ya kipekee — {{date}} katika {{location}}. Thibitisha kabla ya {{deadline}}: {{link}}',4,ARRAY['date','location','deadline','link'],false),
 ('product_prelaunch','marketing','en','{{name}}, Founder pre-launch access is open for {{product}} at KSH {{price}} until {{date}}. Reply ORDER to reserve yours.',4,ARRAY['name','product','price','date'],false)
ON CONFLICT (template_name, language) DO NOTHING;

-- ---------------------------------------------------------
-- Queue helper + automation triggers
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_whatsapp(
  p_client_id uuid,
  p_template text,
  p_params jsonb,
  p_founder_id uuid DEFAULT NULL,
  p_category text DEFAULT 'appointments'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c record;
  phone text;
  new_id uuid;
BEGIN
  IF p_client_id IS NULL THEN RETURN NULL; END IF;
  SELECT id, whatsapp_number, phone, whatsapp_opt_in, whatsapp_opt_out, whatsapp_prefs
    INTO c FROM public.clients WHERE id = p_client_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF c.whatsapp_opt_out OR NOT c.whatsapp_opt_in THEN RETURN NULL; END IF;
  IF COALESCE((c.whatsapp_prefs ->> p_category)::boolean, true) = false THEN RETURN NULL; END IF;

  phone := COALESCE(NULLIF(c.whatsapp_number, ''), NULLIF(c.phone, ''));
  IF phone IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.whatsapp_logs (client_id, founder_id, recipient_phone, template_name, parameters, status, created_by)
  VALUES (p_client_id, p_founder_id, phone, p_template, COALESCE(p_params, '{}'::jsonb), 'queued', 'automation')
  RETURNING id INTO new_id;
  RETURN new_id;
END; $$;

-- Founder enrolment
CREATE OR REPLACE FUNCTION public.trg_wa_founder_enrolled() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.queue_whatsapp(NEW.client_id, 'founder_welcome',
    jsonb_build_object('number', COALESCE(NEW.founder_number::text, '—'), 'link', 'https://coteriesanctuary.lovable.app'),
    NEW.id, 'events');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_founder_enrolled ON public.founder_circle;
CREATE TRIGGER wa_founder_enrolled AFTER INSERT ON public.founder_circle
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_founder_enrolled();

-- Appointments booked / cancelled
CREATE OR REPLACE FUNCTION public.trg_wa_appointment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE svc text;
BEGIN
  svc := COALESCE(NEW.service_description, replace(NEW.appointment_type::text, '_', ' '));
  IF TG_OP = 'INSERT' AND NEW.status = 'booked' THEN
    PERFORM public.queue_whatsapp(NEW.client_id, 'appointment_reminder',
      jsonb_build_object('service', svc, 'date', to_char(NEW.scheduled_date, 'DD Mon YYYY'),
                         'time', to_char(NEW.scheduled_time, 'HH24:MI'), 'studio_number', '+254722365861'),
      NULL, 'appointments');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.queue_whatsapp(NEW.client_id, 'appointment_cancelled',
      jsonb_build_object('service', svc, 'date', to_char(NEW.scheduled_date, 'DD Mon YYYY'),
                         'time', to_char(NEW.scheduled_time, 'HH24:MI')),
      NULL, 'appointments');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_appointment ON public.appointments;
CREATE TRIGGER wa_appointment AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_appointment();

-- Surprise moments
CREATE OR REPLACE FUNCTION public.trg_wa_surprise() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cid uuid;
BEGIN
  SELECT client_id INTO cid FROM public.founder_circle WHERE id = NEW.founder_id;
  PERFORM public.queue_whatsapp(cid, 'surprise_moment',
    jsonb_build_object('perk', replace(NEW.surprise_type, '_', ' '),
                       'date', to_char(NEW.awarded_date + 14, 'DD Mon YYYY')),
    NEW.founder_id, 'perks');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_surprise ON public.surprise_moments_log;
CREATE TRIGGER wa_surprise AFTER INSERT ON public.surprise_moments_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_surprise();

-- Brunch events -> invite every active founder
CREATE OR REPLACE FUNCTION public.trg_wa_brunch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE f record;
BEGIN
  IF NEW.status <> 'upcoming' THEN RETURN NEW; END IF;
  FOR f IN SELECT id, client_id FROM public.founder_circle WHERE status = 'active' LOOP
    PERFORM public.queue_whatsapp(f.client_id, 'brunch_invite',
      jsonb_build_object('date', to_char(NEW.event_date, 'DD Mon YYYY'),
                         'location', COALESCE(NEW.venue, 'COTERIE Nail Sanctuary'),
                         'deadline', to_char(NEW.event_date - 3, 'DD Mon YYYY'),
                         'link', 'https://coteriesanctuary.lovable.app'),
      f.id, 'events');
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_brunch ON public.founder_brunch_events;
CREATE TRIGGER wa_brunch AFTER INSERT ON public.founder_brunch_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_brunch();

-- Payment received
CREATE OR REPLACE FUNCTION public.trg_wa_payment_paid() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE term date;
BEGIN
  IF NEW.status = 'paid' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT term_end_date INTO term FROM public.founder_circle WHERE id = NEW.founder_id;
    PERFORM public.queue_whatsapp(NEW.client_id, 'payment_confirmation',
      jsonb_build_object('amount', to_char(NEW.amount_ksh, 'FM999,999,990'),
                         'date', COALESCE(to_char(term, 'DD Mon YYYY'), 'your term end')),
      NEW.founder_id, 'payments');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_payment_paid ON public.payments;
CREATE TRIGGER wa_payment_paid AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_payment_paid();

-- Product pre-launch -> founders get early access notice
CREATE OR REPLACE FUNCTION public.trg_wa_product_prelaunch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE f record;
BEGIN
  IF NEW.launch_status::text <> 'prelaunch' THEN RETURN NEW; END IF;
  FOR f IN SELECT fc.id, fc.client_id, c.full_name FROM public.founder_circle fc
             JOIN public.clients c ON c.id = fc.client_id WHERE fc.status = 'active' LOOP
    PERFORM public.queue_whatsapp(f.client_id, 'product_prelaunch',
      jsonb_build_object('product', NEW.name,
                         'price', to_char(NEW.founder_price, 'FM999,999,990'),
                         'date', to_char((now() + interval '14 days')::date, 'DD Mon YYYY')),
      f.id, 'marketing');
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wa_product_prelaunch ON public.products;
CREATE TRIGGER wa_product_prelaunch AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_wa_product_prelaunch();
