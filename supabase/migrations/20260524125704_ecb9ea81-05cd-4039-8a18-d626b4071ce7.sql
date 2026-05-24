
-- Enums
CREATE TYPE client_type AS ENUM ('regular','founder');
CREATE TYPE client_status AS ENUM ('active','inactive');
CREATE TYPE appointment_type AS ENUM ('weekly_refresh','gel_rescue','travel_touchup','full_manicure','pedicure','surprise_full','random_upgrade','birthday_sanctuary','emergency');
CREATE TYPE appointment_status AS ENUM ('booked','completed','no-show','cancelled','forfeited');
CREATE TYPE appointment_location AS ENUM ('studio','travel');
CREATE TYPE founder_status AS ENUM ('active','expired','pending');
CREATE TYPE payment_method AS ENUM ('full','installment');
CREATE TYPE perk_type AS ENUM ('weekly_refresh','gel_rescue','travel_touchup','surprise_full','birthday_sanctuary','random_upgrade','just_because');
CREATE TYPE perk_status AS ENUM ('available','used','expired','forfeited');
CREATE TYPE product_category AS ENUM ('cuticle_oil','shoe_horn','gloves','magnetic_clasp');
CREATE TYPE product_launch AS ENUM ('prelaunch','public');
CREATE TYPE brunch_event_status AS ENUM ('upcoming','completed','cancelled');
CREATE TYPE brunch_attendance_status AS ENUM ('confirmed','attended','no_show');

-- clients
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp_number TEXT,
  birthday DATE,
  address TEXT,
  service_area TEXT,
  client_type client_type NOT NULL DEFAULT 'regular',
  status client_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- founder_circle
CREATE TABLE public.founder_circle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  term_end_date DATE,
  enrollment_fee_paid BOOLEAN NOT NULL DEFAULT false,
  payment_method payment_method,
  installment_count INTEGER DEFAULT 0,
  total_paid_ksh NUMERIC(12,2) DEFAULT 0,
  status founder_status NOT NULL DEFAULT 'pending',
  founder_number INTEGER UNIQUE CHECK (founder_number BETWEEN 1 AND 25),
  referral_count INTEGER NOT NULL DEFAULT 0,
  total_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  engagement_score NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_type appointment_type NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  status appointment_status NOT NULL DEFAULT 'booked',
  location appointment_location NOT NULL DEFAULT 'studio',
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- perks_usage
CREATE TABLE public.perks_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES public.founder_circle(id) ON DELETE CASCADE,
  perk_type perk_type NOT NULL,
  week_number INTEGER,
  month_number INTEGER,
  used_date DATE,
  expiry_date DATE,
  status perk_status NOT NULL DEFAULT 'available',
  related_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- surprise_moments_log
CREATE TABLE public.surprise_moments_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES public.founder_circle(id) ON DELETE CASCADE,
  surprise_type TEXT NOT NULL,
  awarded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  awarded_reason TEXT,
  related_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  documented_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category product_category NOT NULL,
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  founder_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  launch_status product_launch NOT NULL DEFAULT 'prelaunch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- founder_purchases
CREATE TABLE public.founder_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_id UUID NOT NULL REFERENCES public.founder_circle(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_applied NUMERIC(12,2) NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  prelaunch_window BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- founder_brunch_events
CREATE TABLE public.founder_brunch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_date DATE NOT NULL,
  venue TEXT,
  status brunch_event_status NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- brunch_attendance
CREATE TABLE public.brunch_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.founder_brunch_events(id) ON DELETE CASCADE,
  founder_id UUID NOT NULL REFERENCES public.founder_circle(id) ON DELETE CASCADE,
  attendance_status brunch_attendance_status NOT NULL DEFAULT 'confirmed',
  dietary_notes TEXT,
  photo_consent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_circle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perks_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surprise_moments_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_brunch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brunch_attendance ENABLE ROW LEVEL SECURITY;

-- Permissive staff policies (internal POS — open access for now; add auth later)
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','founder_circle','appointments','perks_usage','surprise_moments_log','products','founder_purchases','founder_brunch_events','brunch_attendance']) LOOP
    EXECUTE format('CREATE POLICY "Public read %I" ON public.%I FOR SELECT USING (true);', t, t);
    EXECUTE format('CREATE POLICY "Public write %I" ON public.%I FOR INSERT WITH CHECK (true);', t, t);
    EXECUTE format('CREATE POLICY "Public update %I" ON public.%I FOR UPDATE USING (true);', t, t);
    EXECUTE format('CREATE POLICY "Public delete %I" ON public.%I FOR DELETE USING (true);', t, t);
  END LOOP;
END $$;
