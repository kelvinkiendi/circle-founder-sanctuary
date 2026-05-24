
-- App settings (key/value JSON store)
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Public write app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update app_settings" ON public.app_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete app_settings" ON public.app_settings FOR DELETE USING (true);

-- Staff
CREATE TYPE public.staff_role AS ENUM ('admin','manager','technician','reception');
CREATE TABLE public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  pin text,
  role public.staff_role NOT NULL DEFAULT 'technician',
  email text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Public write staff" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff" ON public.staff FOR UPDATE USING (true);
CREATE POLICY "Public delete staff" ON public.staff FOR DELETE USING (true);

-- Activity log
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text,
  action text NOT NULL,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read activity_log" ON public.activity_log FOR SELECT USING (true);
CREATE POLICY "Public write activity_log" ON public.activity_log FOR INSERT WITH CHECK (true);

-- Studio locations
CREATE TABLE public.studio_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.studio_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read studio_locations" ON public.studio_locations FOR SELECT USING (true);
CREATE POLICY "Public write studio_locations" ON public.studio_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update studio_locations" ON public.studio_locations FOR UPDATE USING (true);
CREATE POLICY "Public delete studio_locations" ON public.studio_locations FOR DELETE USING (true);

INSERT INTO public.studio_locations (name, address, phone, is_primary)
VALUES ('Shujaah Mall · Kilimani', 'Shujaah Mall, opposite Adlife Plaza, Kilimani, Nairobi', '+254 700 000 000', true);

-- Seed default settings buckets
INSERT INTO public.app_settings (key, value) VALUES
('business', '{"name":"COTERIE Nail Sanctuary","address":"Shujaah Mall, opposite Adlife Plaza, Kilimani, Nairobi","phone":"+254 700 000 000","email":"hello@coterie.co.ke","tax_pin":"P051000000X","brand_primary":"#5D4037","brand_accent":"#F5F5DC","logo_url":""}'),
('hours', '{"weekday_open":"09:00","weekday_close":"19:00","sat_open":"09:00","sat_close":"18:00","sun_open":"10:00","sun_close":"16:00","after_hours_emergency":true}'),
('founder_rules', '{"max_founders":25,"term_months":6,"enrollment_fee":25000,"installments":["full","2","3"],"weekly_reschedule_limit":2,"weekly_noshow_forfeit":true,"weekly_carryover":false,"gel_rescue_days":7,"gel_negligence_charges":true,"travel_monthly_limit":1,"travel_duration_max":10,"travel_transport_charge":500,"birthday_days_before":3,"birthday_days_after":3,"surprise_full_max":2,"upgrade_max":2,"upgrade_dedup_days":60,"just_because_top_n":5,"weight_spend":0.4,"weight_referrals":0.3,"weight_engagement":0.3,"founder_rate_discount":15,"active_relationship_months":12}'),
('notifications', '{"whatsapp_enabled":true,"email_backup":false,"in_app":true,"templates":{"founder_welcome":true,"weekly_refresh_reminder":true,"priority_window":true,"birthday":true,"gel_rescue":true,"no_show_forfeit":true,"emergency":true,"installment_reminder":true,"term_expiring":true,"surprise_award":true,"travel_confirmed":true,"product_prelaunch":true},"term_expiry_warning_days":30,"low_stock_threshold":5,"no_show_streak_alert":2}'),
('service_area', '{"core_zones":["Kilimani","Yaya","Hurlingham","Lavington"],"extended_zones":["Westlands","Kileleshwa","Karen","Lang''ata"],"transport_charge":500}'),
('integrations', '{"mpesa_env":"sandbox","mpesa_shortcode":"","whatsapp_phone_id":"","supabase_url":"","custom_domain":"thecircle.coterie.co.ke"}'),
('data', '{"auto_backup_enabled":true,"auto_backup_hour":2,"retention_months_after_term":12}');

INSERT INTO public.staff (full_name, role, pin, email) VALUES
('Founder · COTERIE', 'admin', '0000', 'founder@coterie.co.ke'),
('Amani K.', 'technician', '1234', 'amani@coterie.co.ke'),
('Nia M.', 'technician', '2580', 'nia@coterie.co.ke');
