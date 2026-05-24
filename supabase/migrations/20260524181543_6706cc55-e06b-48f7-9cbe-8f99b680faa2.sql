
-- Services catalog
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  price_ksh NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'manicure'
    CHECK (category IN ('manicure','pedicure','gel','nail_art','treatment','add-on')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  eligible_roles TEXT[] NOT NULL DEFAULT ARRAY['admin','manager','technician','reception']::TEXT[],
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Public write services" ON public.services FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update services" ON public.services FOR UPDATE USING (true);
CREATE POLICY "Public delete services" ON public.services FOR DELETE USING (true);

CREATE TRIGGER set_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment line items
CREATE TABLE IF NOT EXISTS public.payment_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL,
  service_id UUID,
  service_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read payment_line_items" ON public.payment_line_items FOR SELECT USING (true);
CREATE POLICY "Public write payment_line_items" ON public.payment_line_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update payment_line_items" ON public.payment_line_items FOR UPDATE USING (true);
CREATE POLICY "Public delete payment_line_items" ON public.payment_line_items FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_pli_payment_id ON public.payment_line_items(payment_id);

-- Appointment service link
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id UUID,
  ADD COLUMN IF NOT EXISTS service_description TEXT;

-- Seed default services
INSERT INTO public.services (name, duration_minutes, price_ksh, category, description, display_order) VALUES
  ('Weekly Refresh',          15, 500,   'manicure',  'Weekly nail refresh',                       10),
  ('Full Manicure',           60, 1500,  'manicure',  'Full manicure service',                     20),
  ('Gel Manicure',            75, 2500,  'gel',       'Gel manicure service',                      30),
  ('Full Pedicure',           60, 1500,  'pedicure',  'Full pedicure service',                     40),
  ('Gel Pedicure',            75, 2500,  'gel',       'Gel pedicure service',                      50),
  ('Gel Rescue',              15, 0,     'gel',       'Gel rescue (perk-eligible)',                60),
  ('Travel Touch-Up',         10, 0,     'add-on',    'Travel touch-up (perk + transport)',        70),
  ('Nail Art',                30, 800,   'nail_art',  'Custom nail art',                           80),
  ('Paraffin Treatment',      20, 1000,  'treatment', 'Paraffin hand treatment',                   90),
  ('Cuticle Oil Application', 10, 300,   'add-on',    'Cuticle oil application',                   100)
ON CONFLICT DO NOTHING;
