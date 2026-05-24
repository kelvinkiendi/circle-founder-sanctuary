
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_source text,
  ADD COLUMN IF NOT EXISTS first_visit_date date,
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS public.founder_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  priority_score integer NOT NULL DEFAULT 0,
  notes text,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

ALTER TABLE public.founder_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read founder_waitlist" ON public.founder_waitlist FOR SELECT USING (true);
CREATE POLICY "Public write founder_waitlist" ON public.founder_waitlist FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update founder_waitlist" ON public.founder_waitlist FOR UPDATE USING (true);
CREATE POLICY "Public delete founder_waitlist" ON public.founder_waitlist FOR DELETE USING (true);
