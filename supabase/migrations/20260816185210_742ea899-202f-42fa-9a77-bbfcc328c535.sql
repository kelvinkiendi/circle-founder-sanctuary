REVOKE EXECUTE ON FUNCTION public.queue_whatsapp(uuid, text, jsonb, uuid, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_founder_enrolled() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_appointment() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_surprise() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_brunch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_payment_paid() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_wa_product_prelaunch() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.queue_whatsapp(uuid, text, jsonb, uuid, text) TO service_role;