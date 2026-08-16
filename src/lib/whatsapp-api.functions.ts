import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Session = z.object({ sessionId: z.string().uuid() });

const STAFF_ROLES = ["admin", "manager", "reception", "technician"] as const;
const ADMIN_ROLES = ["admin", "manager"] as const;

/** Connection status + configuration health (no secrets ever leave the server). */
export const getWhatsAppStatusFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { providerConfig } = await import("@/lib/whatsapp-provider.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId);
    const cfg = providerConfig();

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [sent, failed, queued, optedIn] = await Promise.all([
      supabaseAdmin.from("whatsapp_logs").select("id", { count: "exact", head: true })
        .in("status", ["sent", "delivered", "read"]).gte("queued_at", since),
      supabaseAdmin.from("whatsapp_logs").select("id", { count: "exact", head: true })
        .eq("status", "failed").gte("queued_at", since),
      supabaseAdmin.from("whatsapp_logs").select("id", { count: "exact", head: true }).eq("status", "queued"),
      supabaseAdmin.from("clients").select("id", { count: "exact", head: true }).eq("whatsapp_opt_in", true),
    ]);

    return {
      provider: cfg.provider,
      connected: cfg.configured,
      phoneNumberId: cfg.phoneNumberId ? `••••${cfg.phoneNumberId.slice(-4)}` : null,
      hasToken: cfg.hasToken,
      hasVerifyToken: cfg.hasVerifyToken,
      apiVersion: cfg.apiVersion,
      adminNumber: cfg.adminNumber,
      sent24h: sent.count ?? 0,
      failed24h: failed.count ?? 0,
      queued: queued.count ?? 0,
      optedInClients: optedIn.count ?? 0,
    };
  });

/** Filterable message log. */
export const listWhatsAppLogsFn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    Session.extend({
      clientId: z.string().uuid().nullish(),
      templateName: z.string().max(80).nullish(),
      status: z.enum(["queued", "sent", "delivered", "read", "failed"]).nullish(),
      from: z.string().max(30).nullish(),
      to: z.string().max(30).nullish(),
      limit: z.number().int().min(1).max(200).default(100),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId, [...STAFF_ROLES, "guardian", "partner"]);

    let q = supabaseAdmin
      .from("whatsapp_logs")
      .select("id, client_id, recipient_phone, template_name, language, status, body_text, error_message, queued_at, sent_at, delivered_at, read_at, created_by, clients(full_name)")
      .order("queued_at", { ascending: false })
      .limit(data.limit);

    if (data.clientId) q = q.eq("client_id", data.clientId);
    if (data.templateName) q = q.eq("template_name", data.templateName);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("queued_at", `${data.from}T00:00:00Z`);
    if (data.to) q = q.lte("queued_at", `${data.to}T23:59:59Z`);

    const { data: rows, error } = await q;
    if (error) {
      const { dbError } = await import("@/lib/staff-auth.server");
      dbError(error, "wa_logs");
    }
    return (rows ?? []) as any[];
  });

/** Template library. */
export const listWhatsAppTemplatesFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin
      .from("whatsapp_templates")
      .select("*")
      .order("category")
      .order("template_name")
      .order("language");
    return (rows ?? []) as any[];
  });

export const setTemplateActiveFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ id: z.string().uuid(), isActive: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    const { requireStaff, dbError } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId, [...ADMIN_ROLES]);
    const { error } = await supabaseAdmin
      .from("whatsapp_templates").update({ is_active: data.isActive }).eq("id", data.id);
    if (error) dbError(error, "wa_tpl");
    return { ok: true };
  });

export const updateTemplateBodyFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ id: z.string().uuid(), bodyText: z.string().min(5).max(1200) }).parse(i))
  .handler(async ({ data }) => {
    const { requireStaff, dbError } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId, [...ADMIN_ROLES]);
    const { error } = await supabaseAdmin
      .from("whatsapp_templates").update({ body_text: data.bodyText }).eq("id", data.id);
    if (error) dbError(error, "wa_tpl");
    return { ok: true };
  });

/** Send a template to a client (respects consent, preferences and rate limits). */
export const sendTemplateFn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    Session.extend({
      clientId: z.string().uuid(),
      templateName: z.string().min(2).max(80),
      language: z.string().min(2).max(5).default("en"),
      params: z.record(z.string(), z.string()).default({}),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { sendWhatsApp } = await import("@/lib/whatsapp-provider.server");
    const staff = await requireStaff(data.sessionId, [...STAFF_ROLES]);
    return sendWhatsApp({
      clientId: data.clientId,
      templateName: data.templateName,
      language: data.language,
      params: data.params,
      createdBy: `staff:${staff.staff_id}`,
    });
  });

/** Test-send to an admin/test number, bypassing client consent but not the provider. */
export const testSendFn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    Session.extend({
      phone: z.string().min(7).max(20),
      templateName: z.string().min(2).max(80),
      language: z.string().min(2).max(5).default("en"),
      params: z.record(z.string(), z.string()).default({}),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { sendWhatsApp, normalizePhone } = await import("@/lib/whatsapp-provider.server");
    const staff = await requireStaff(data.sessionId, [...ADMIN_ROLES]);
    const phone = normalizePhone(data.phone);
    if (!phone) throw new Error("Invalid phone number — use +2547XXXXXXXX");
    return sendWhatsApp({
      phone,
      templateName: data.templateName,
      language: data.language,
      params: { name: "Admin", ...data.params },
      createdBy: `test:${staff.staff_id}`,
      skipConsent: true,
    });
  });

/** Consent + per-category notification preferences. */
export const setWhatsAppConsentFn = createServerFn({ method: "POST" })
  .inputValidator((i) =>
    Session.extend({
      clientId: z.string().uuid(),
      optIn: z.boolean().optional(),
      prefs: z
        .object({
          appointments: z.boolean(),
          perks: z.boolean(),
          events: z.boolean(),
          payments: z.boolean(),
          marketing: z.boolean(),
        })
        .partial()
        .optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { requireStaff, dbError } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId, [...STAFF_ROLES]);

    const { data: current } = await supabaseAdmin
      .from("clients").select("whatsapp_prefs").eq("id", data.clientId).maybeSingle();

    const patch: Record<string, unknown> = {};
    if (typeof data.optIn === "boolean") {
      patch.whatsapp_opt_in = data.optIn;
      patch.whatsapp_opt_out = !data.optIn;
      patch.whatsapp_opt_in_at = data.optIn ? new Date().toISOString() : null;
    }
    if (data.prefs) {
      patch.whatsapp_prefs = { ...((current?.whatsapp_prefs ?? {}) as object), ...data.prefs };
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabaseAdmin.from("clients").update(patch).eq("id", data.clientId);
    if (error) dbError(error, "wa_consent");
    return { ok: true };
  });

export const getWhatsAppConsentFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireStaff(data.sessionId);
    const { data: row } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, whatsapp_number, whatsapp_opt_in, whatsapp_opt_out, whatsapp_opt_in_at, whatsapp_prefs")
      .eq("id", data.clientId)
      .maybeSingle();
    return row as any;
  });

/** Drains queued automation messages (also runnable from the cron endpoint). */
export const dispatchQueuedFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ limit: z.number().int().min(1).max(100).default(50) }).parse(i))
  .handler(async ({ data }) => {
    const { requireStaff } = await import("@/lib/staff-auth.server");
    const { dispatchQueued } = await import("@/lib/whatsapp-dispatch.server");
    await requireStaff(data.sessionId, [...ADMIN_ROLES]);
    return dispatchQueued(data.limit);
  });
