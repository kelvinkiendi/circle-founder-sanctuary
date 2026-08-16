import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Kenya (and general E.164) phone normalisation. Returns +2547XXXXXXXX or null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("0") && p.length === 10) p = "254" + p.slice(1);
  if ((p.startsWith("7") || p.startsWith("1")) && p.length === 9) p = "254" + p;
  if (/^254[17]\d{8}$/.test(p)) return "+" + p;
  // Allow other valid-looking international numbers (admin test numbers etc.)
  if (/^\d{10,15}$/.test(p)) return "+" + p;
  return null;
}

/** Renders {{var}} placeholders. Missing values render as an em dash. */
export function renderTemplate(body: string, params: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => params[k] ?? "—");
}

/** East Africa Time (UTC+3) formatting used across all customer-facing timestamps. */
export function formatEAT(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type ProviderConfig = {
  configured: boolean;
  provider: "meta" | "twilio" | "log-only";
  phoneNumberId: string | null;
  hasToken: boolean;
  hasVerifyToken: boolean;
  apiVersion: string;
  adminNumber: string | null;
};

export function providerConfig(): ProviderConfig {
  const token = process.env.WHATSAPP_API_TOKEN ?? null;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? null;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID ?? null;
  const provider: ProviderConfig["provider"] = token && phoneNumberId
    ? "meta"
    : twilioSid
      ? "twilio"
      : "log-only";
  return {
    configured: provider !== "log-only",
    provider,
    phoneNumberId,
    hasToken: !!token,
    hasVerifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    apiVersion: process.env.WHATSAPP_API_VERSION ?? "v20.0",
    adminNumber: process.env.WHATSAPP_ADMIN_NUMBER ?? null,
  };
}

/** Rate limit: 1 message per template per client per hour, unless the template is critical. */
export async function rateLimited(
  clientId: string | null,
  phone: string,
  templateName: string,
  isCritical: boolean,
): Promise<boolean> {
  if (isCritical) return false;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  let q = supabaseAdmin
    .from("whatsapp_logs")
    .select("id", { count: "exact", head: true })
    .eq("template_name", templateName)
    .in("status", ["sent", "delivered", "read"])
    .gte("sent_at", since);
  q = clientId ? q.eq("client_id", clientId) : q.eq("recipient_phone", phone);
  const { count } = await q;
  return (count ?? 0) > 0;
}

export type TemplateRow = {
  id: string;
  template_name: string;
  category: string;
  language: string;
  body_text: string;
  variables: string[];
  variables_count: number;
  is_active: boolean;
  is_critical: boolean;
};

export async function loadTemplate(name: string, language = "en"): Promise<TemplateRow | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("*")
    .eq("template_name", name)
    .eq("is_active", true)
    .in("language", [language, "en"])
    .order("language", { ascending: language === "en" });
  const rows = (data ?? []) as unknown as TemplateRow[];
  return rows.find((r) => r.language === language) ?? rows[0] ?? null;
}

type DeliveryResult = { status: "sent" | "failed"; metaMessageId: string | null; error: string | null };

/** Performs the actual provider call. Falls back to log-only mode when unconfigured. */
export async function deliver(phone: string, body: string): Promise<DeliveryResult> {
  const cfg = providerConfig();

  if (cfg.provider === "meta") {
    try {
      const url = `https://graph.facebook.com/${cfg.apiVersion}/${cfg.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: phone.replace(/\D/g, ""),
          type: "text",
          text: { preview_url: true, body },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        return {
          status: "failed",
          metaMessageId: null,
          error: (json?.error?.message ?? `HTTP ${res.status}`).slice(0, 400),
        };
      }
      return { status: "sent", metaMessageId: json?.messages?.[0]?.id ?? null, error: null };
    } catch (e) {
      return { status: "failed", metaMessageId: null, error: String((e as Error)?.message ?? e).slice(0, 400) };
    }
  }

  if (cfg.provider === "twilio") {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const auth = btoa(`${sid}:${process.env.TWILIO_AUTH_TOKEN ?? ""}`);
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: `whatsapp:${phone}`,
          From: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM ?? ""}`,
          Body: body,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as any;
      if (!res.ok) {
        return { status: "failed", metaMessageId: null, error: (json?.message ?? `HTTP ${res.status}`).slice(0, 400) };
      }
      return { status: "sent", metaMessageId: json?.sid ?? null, error: null };
    } catch (e) {
      return { status: "failed", metaMessageId: null, error: String((e as Error)?.message ?? e).slice(0, 400) };
    }
  }

  // Log-only mode: message is recorded but never leaves the system.
  return { status: "sent", metaMessageId: null, error: null };
}

export type SendOutcome = {
  ok: boolean;
  logId: string | null;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  body?: string;
  error?: string | null;
};

/**
 * Full send pipeline: consent -> template -> rate limit -> provider -> log.
 * `logId` may point at an existing queued row (automation queue) to update in place.
 */
export async function sendWhatsApp(opts: {
  clientId?: string | null;
  founderId?: string | null;
  phone?: string | null;
  templateName: string;
  language?: string;
  params?: Record<string, string>;
  createdBy?: string;
  existingLogId?: string | null;
  skipConsent?: boolean;
}): Promise<SendOutcome> {
  const language = opts.language ?? "en";
  const params = opts.params ?? {};
  let phone = normalizePhone(opts.phone ?? null);
  let clientId = opts.clientId ?? null;

  if (clientId) {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, whatsapp_number, whatsapp_opt_in, whatsapp_opt_out, whatsapp_prefs")
      .eq("id", clientId)
      .maybeSingle();
    if (!client) return { ok: false, logId: null, status: "skipped", reason: "client_not_found" };
    if (!opts.skipConsent && (client.whatsapp_opt_out || !client.whatsapp_opt_in)) {
      return { ok: false, logId: null, status: "skipped", reason: "no_consent" };
    }
    phone = phone ?? normalizePhone(client.whatsapp_number ?? client.phone);
    if (!params.name) params.name = (client.full_name ?? "there").split(" ")[0];
  }

  if (!phone) return { ok: false, logId: null, status: "skipped", reason: "invalid_phone" };

  const tpl = await loadTemplate(opts.templateName, language);
  if (!tpl) return { ok: false, logId: null, status: "skipped", reason: "template_not_found" };

  if (clientId) {
    const { data: client } = await supabaseAdmin
      .from("clients").select("whatsapp_prefs").eq("id", clientId).maybeSingle();
    const prefs = (client?.whatsapp_prefs ?? {}) as Record<string, boolean>;
    if (!opts.skipConsent && prefs[tpl.category] === false) {
      return { ok: false, logId: null, status: "skipped", reason: "category_muted" };
    }
  }

  if (await rateLimited(clientId, phone, tpl.template_name, tpl.is_critical)) {
    return { ok: false, logId: null, status: "skipped", reason: "rate_limited" };
  }

  const body = renderTemplate(tpl.body_text, params);
  const result = await deliver(phone, body);
  const now = new Date().toISOString();

  const row = {
    client_id: clientId,
    founder_id: opts.founderId ?? null,
    recipient_phone: phone,
    template_name: tpl.template_name,
    language: tpl.language,
    parameters: params,
    body_text: body,
    status: result.status,
    meta_message_id: result.metaMessageId,
    error_message: result.error,
    sent_at: result.status === "sent" ? now : null,
    created_by: opts.createdBy ?? "system",
  };

  let logId = opts.existingLogId ?? null;
  if (logId) {
    await supabaseAdmin.from("whatsapp_logs").update(row).eq("id", logId);
  } else {
    const { data: inserted } = await supabaseAdmin
      .from("whatsapp_logs").insert(row).select("id").single();
    logId = inserted?.id ?? null;
  }

  // Mirror into the legacy ledger so existing history views stay complete.
  if (clientId) {
    await supabaseAdmin.from("whatsapp_messages").insert({
      client_id: clientId,
      template_key: tpl.template_name,
      message_type: tpl.category,
      phone_number: phone,
      body,
      status: result.status,
      error: result.error,
      created_by: opts.createdBy ?? "system",
    });
  }

  return { ok: result.status === "sent", logId, status: result.status, body, error: result.error };
}
