
-- ============== 1. Staff PIN setter (admin uses this when adding/editing staff) ==============
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_staff_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;
  UPDATE public.staff
     SET pin_hash = crypt(p_pin, gen_salt('bf')),
         pin = NULL,
         failed_attempts = 0,
         locked_until = NULL,
         must_change_pin = false,
         active = true
   WHERE id = p_staff_id;
  RETURN FOUND;
END;
$$;

-- ============== 2. Commission settings ==============
CREATE TABLE IF NOT EXISTS public.staff_commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  commission_percentage numeric(5,2) NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'percentage_of_sale'
    CHECK (commission_type IN ('percentage_of_sale','fixed_per_service','hybrid')),
  fixed_amount_ksh numeric(10,2) NOT NULL DEFAULT 0,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  set_by uuid,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_staff_active
  ON public.staff_commission_settings(staff_id, is_active, effective_date DESC);

ALTER TABLE public.staff_commission_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff_commission_settings" ON public.staff_commission_settings FOR SELECT USING (true);
CREATE POLICY "Public write staff_commission_settings" ON public.staff_commission_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff_commission_settings" ON public.staff_commission_settings FOR UPDATE USING (true);
CREATE POLICY "Public delete staff_commission_settings" ON public.staff_commission_settings FOR DELETE USING (true);

-- ============== 3. Earnings ledger ==============
CREATE TABLE IF NOT EXISTS public.staff_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL,
  payment_id uuid,
  appointment_id uuid,
  service_id uuid,
  service_name text,
  sale_amount_ksh numeric(10,2) NOT NULL DEFAULT 0,
  commission_percentage numeric(5,2) NOT NULL DEFAULT 0,
  commission_earned_ksh numeric(10,2) NOT NULL DEFAULT 0,
  fixed_bonus_ksh numeric(10,2) NOT NULL DEFAULT 0,
  total_commission_ksh numeric(10,2) NOT NULL DEFAULT 0,
  earnings_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_earnings_staff_date ON public.staff_earnings(staff_id, earnings_date DESC);
CREATE INDEX IF NOT EXISTS idx_earnings_payment ON public.staff_earnings(payment_id);

ALTER TABLE public.staff_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read staff_earnings" ON public.staff_earnings FOR SELECT USING (true);
CREATE POLICY "Public write staff_earnings" ON public.staff_earnings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update staff_earnings" ON public.staff_earnings FOR UPDATE USING (true);
CREATE POLICY "Public delete staff_earnings" ON public.staff_earnings FOR DELETE USING (true);

-- ============== 4. Earnings recorder + trigger ==============
CREATE OR REPLACE FUNCTION public.record_staff_earnings_for_payment(p_payment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay record;
  tech_id uuid;
  cs record;
  inserted int := 0;
  item record;
  line_commission numeric;
BEGIN
  SELECT * INTO pay FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF pay.status::text <> 'paid' OR pay.amount_ksh IS NULL OR pay.amount_ksh <= 0 THEN RETURN 0; END IF;

  -- Resolve technician from created_by tag "tech:<uuid>"
  IF pay.created_by IS NULL OR pay.created_by NOT LIKE 'tech:%' THEN RETURN 0; END IF;
  BEGIN
    tech_id := substring(pay.created_by from 6)::uuid;
  EXCEPTION WHEN others THEN RETURN 0; END;

  -- Already recorded?
  IF EXISTS (SELECT 1 FROM public.staff_earnings WHERE payment_id = p_payment_id) THEN RETURN 0; END IF;

  -- Active commission setting (most recent effective <= today)
  SELECT * INTO cs FROM public.staff_commission_settings
    WHERE staff_id = tech_id AND is_active = true AND effective_date <= CURRENT_DATE
    ORDER BY effective_date DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    cs.commission_percentage := 0;
    cs.commission_type := 'percentage_of_sale';
    cs.fixed_amount_ksh := 0;
  END IF;

  -- Per-line items if present
  IF EXISTS (SELECT 1 FROM public.payment_line_items WHERE payment_id = p_payment_id) THEN
    FOR item IN
      SELECT * FROM public.payment_line_items WHERE payment_id = p_payment_id
    LOOP
      IF item.total_price IS NULL OR item.total_price <= 0 THEN CONTINUE; END IF;
      line_commission := CASE
        WHEN cs.commission_type = 'fixed_per_service' THEN cs.fixed_amount_ksh * item.quantity
        WHEN cs.commission_type = 'hybrid' THEN ROUND(item.total_price * cs.commission_percentage / 100.0, 2) + (cs.fixed_amount_ksh * item.quantity)
        ELSE ROUND(item.total_price * cs.commission_percentage / 100.0, 2)
      END;
      INSERT INTO public.staff_earnings (
        staff_id, payment_id, appointment_id, service_id, service_name,
        sale_amount_ksh, commission_percentage, commission_earned_ksh, fixed_bonus_ksh, total_commission_ksh,
        earnings_date
      ) VALUES (
        tech_id, p_payment_id, pay.related_appointment_id, item.service_id, item.service_name,
        item.total_price, cs.commission_percentage,
        CASE WHEN cs.commission_type = 'fixed_per_service' THEN 0
             ELSE ROUND(item.total_price * cs.commission_percentage / 100.0, 2) END,
        CASE WHEN cs.commission_type IN ('fixed_per_service','hybrid') THEN cs.fixed_amount_ksh * item.quantity ELSE 0 END,
        line_commission,
        COALESCE(pay.paid_at::date, CURRENT_DATE)
      );
      inserted := inserted + 1;
    END LOOP;
  ELSE
    -- Fallback: single row from the payment total
    line_commission := CASE
      WHEN cs.commission_type = 'fixed_per_service' THEN cs.fixed_amount_ksh
      WHEN cs.commission_type = 'hybrid' THEN ROUND(pay.amount_ksh * cs.commission_percentage / 100.0, 2) + cs.fixed_amount_ksh
      ELSE ROUND(pay.amount_ksh * cs.commission_percentage / 100.0, 2)
    END;
    INSERT INTO public.staff_earnings (
      staff_id, payment_id, appointment_id, service_id, service_name,
      sale_amount_ksh, commission_percentage, commission_earned_ksh, fixed_bonus_ksh, total_commission_ksh,
      earnings_date
    ) VALUES (
      tech_id, p_payment_id, pay.related_appointment_id, NULL, pay.description,
      pay.amount_ksh, cs.commission_percentage,
      CASE WHEN cs.commission_type = 'fixed_per_service' THEN 0
           ELSE ROUND(pay.amount_ksh * cs.commission_percentage / 100.0, 2) END,
      CASE WHEN cs.commission_type IN ('fixed_per_service','hybrid') THEN cs.fixed_amount_ksh ELSE 0 END,
      line_commission,
      COALESCE(pay.paid_at::date, CURRENT_DATE)
    );
    inserted := 1;
  END IF;

  RETURN inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_record_earnings_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'paid' AND (OLD.status IS DISTINCT FROM NEW.status OR TG_OP = 'INSERT') THEN
    PERFORM public.record_staff_earnings_for_payment(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_record_earnings ON public.payments;
CREATE TRIGGER trg_payments_record_earnings
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_record_earnings_on_paid();

-- ============== 5. WhatsApp messages extensions ==============
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS appointment_id uuid,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS phone_number text;

CREATE INDEX IF NOT EXISTS idx_wa_messages_appointment ON public.whatsapp_messages(appointment_id);
