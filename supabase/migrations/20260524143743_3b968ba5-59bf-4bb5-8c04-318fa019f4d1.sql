-- Brand assets bucket for logo uploads
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; permissive write (matches project's permissive RLS pattern)
DO $$ BEGIN
  CREATE POLICY "brand-assets public read"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'brand-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "brand-assets public write"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'brand-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "brand-assets public update"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'brand-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "brand-assets public delete"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'brand-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;