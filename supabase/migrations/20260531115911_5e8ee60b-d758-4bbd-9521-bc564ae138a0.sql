-- Make the existing deny-by-default RLS posture explicit on every public app table.
-- Direct browser/database API roles are denied; trusted server-side service_role bypass remains the only data path.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'activity_log',
    'app_settings',
    'appointments',
    'brunch_attendance',
    'clients',
    'founder_brunch_events',
    'founder_circle',
    'founder_purchases',
    'founder_waitlist',
    'notifications',
    'payment_line_items',
    'payments',
    'perks_usage',
    'product_access_windows',
    'products',
    'receipts',
    'services',
    'staff',
    'staff_commission_settings',
    'staff_earnings',
    'staff_login_log',
    'staff_sessions',
    'studio_locations',
    'surprise_moments_log',
    'whatsapp_messages'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "deny_direct_client_access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "deny_direct_client_access" ON public.%I AS PERMISSIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      t
    );
  END LOOP;
END $$;

-- Stop public listing of brand assets. The bucket is currently unused by active app code.
DROP POLICY IF EXISTS "brand-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "brand_assets_public_read" ON storage.objects;
UPDATE storage.buckets SET public = false WHERE id = 'brand-assets';