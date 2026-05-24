
-- Payment types and statuses
DO $$ BEGIN
  CREATE TYPE public.payment_type AS ENUM (
    'enrollment_full','enrollment_installment_1','enrollment_installment_2',
    'travel_transport','full_service_founder','product_purchase','emergency_service','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  founder_id uuid,
  payment_type public.payment_type NOT NULL,
  amount_ksh numeric NOT NULL,
  phone text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  mpesa_checkout_request_id text,
  mpesa_receipt_number text,
  description text,
  related_appointment_id uuid,
  related_product_id uuid,
  due_date date,
  paid_at timestamptz,
  failure_reason text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Public write payments" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update payments" ON public.payments FOR UPDATE USING (true);
CREATE POLICY "Public delete payments" ON public.payments FOR DELETE USING (true);

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  founder_id uuid,
  receipt_number text NOT NULL UNIQUE,
  amount_ksh numeric NOT NULL,
  description text,
  pdf_url text,
  issued_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read receipts" ON public.receipts FOR SELECT USING (true);
CREATE POLICY "Public write receipts" ON public.receipts FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update receipts" ON public.receipts FOR UPDATE USING (true);
CREATE POLICY "Public delete receipts" ON public.receipts FOR DELETE USING (true);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS payments_updated_at ON public.payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- On payment paid: update founder enrollment totals
CREATE OR REPLACE FUNCTION public.handle_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') AND NEW.founder_id IS NOT NULL THEN
    IF NEW.payment_type IN ('enrollment_full','enrollment_installment_1','enrollment_installment_2') THEN
      UPDATE public.founder_circle
        SET total_paid_ksh = COALESCE(total_paid_ksh,0) + NEW.amount_ksh,
            enrollment_fee_paid = CASE
              WHEN NEW.payment_type = 'enrollment_full' THEN true
              WHEN NEW.payment_type = 'enrollment_installment_2' THEN true
              ELSE enrollment_fee_paid END,
            installment_count = CASE
              WHEN NEW.payment_type = 'enrollment_installment_1' THEN GREATEST(installment_count,1)
              WHEN NEW.payment_type = 'enrollment_installment_2' THEN GREATEST(installment_count,2)
              ELSE installment_count END
        WHERE id = NEW.founder_id;
    END IF;

    IF NEW.paid_at IS NULL THEN NEW.paid_at = now(); END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payments_paid_trigger ON public.payments;
CREATE TRIGGER payments_paid_trigger BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_paid();

-- Suspension sweep function (called by scheduled job or server fn)
CREATE OR REPLACE FUNCTION public.suspend_overdue_founders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer := 0;
BEGIN
  WITH overdue AS (
    SELECT fc.id FROM public.founder_circle fc
    WHERE fc.status = 'active'
      AND fc.payment_method = 'installment'
      AND fc.enrollment_fee_paid = false
      AND fc.enrollment_date < (CURRENT_DATE - INTERVAL '45 days')
  ), upd AS (
    UPDATE public.founder_circle SET status = 'suspended'
    WHERE id IN (SELECT id FROM overdue) RETURNING id
  )
  SELECT count(*) INTO n FROM upd;

  -- Freeze perks for newly-suspended
  UPDATE public.perks_usage SET status = 'forfeited'
  WHERE founder_id IN (SELECT id FROM public.founder_circle WHERE status = 'suspended')
    AND status = 'available';

  RETURN n;
END; $$;

CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_founder ON public.payments(founder_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments(created_at DESC);
