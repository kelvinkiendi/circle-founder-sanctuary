
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  template_key text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  created_by text
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read whatsapp_messages" ON public.whatsapp_messages FOR SELECT USING (true);
CREATE POLICY "Public write whatsapp_messages" ON public.whatsapp_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update whatsapp_messages" ON public.whatsapp_messages FOR UPDATE USING (true);
CREATE POLICY "Public delete whatsapp_messages" ON public.whatsapp_messages FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client ON public.whatsapp_messages(client_id, sent_at DESC);
