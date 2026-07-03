import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getTemplate, type TemplateKey } from "@/lib/whatsapp-templates";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const SENDER_NUMBER = "+254722365861";

const ConfirmInput = z.object({
  sessionId: z.string().uuid(),
  clientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  templateKey: z.enum([
    "appointment_confirmation",
    "appointment_cancellation",
    "new_client_welcome",
    "service_followup_24h",
    "visit_reminder_21d",
    "payment_confirmation",
    "founder_welcome",
  ] as [TemplateKey, ...TemplateKey[]]).default("appointment_confirmation"),
  vars: z.record(z.string(), z.string()).default({}),
});

/**
 * Sends a WhatsApp message via the Business API (if WHATSAPP_API_TOKEN is set)
 * and logs every attempt to whatsapp_messages. Falls back to log-only mode
 * when the secret is missing so booking flows still succeed in development.
 */
export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .inputValidator((i) => ConfirmInput.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin", "manager", "technician", "reception"]);
    // Load client and check opt-out
    const { data: client, error: cErr } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, whatsapp_number, phone, whatsapp_opt_out")
      .eq("id", data.clientId)
      .maybeSingle();
    if (cErr) dbError(cErr);
    if (!client) throw new Error("Client not found");
    if (client.whatsapp_opt_out) return { ok: false as const, reason: "opt_out" };

    const phone = client.whatsapp_number ?? client.phone;
    if (!phone) return { ok: false as const, reason: "no_phone" };

    const tpl = getTemplate(data.templateKey);
    const body = tpl.render({
      name: client.full_name?.split(" ")[0] ?? "there",
      ...data.vars,
    });

    const token = process.env.WHATSAPP_API_TOKEN;
    let status: "sent" | "failed" = "sent";
    let errorMsg: string | null = null;

    if (token) {
      try {
        // Generic WhatsApp Cloud-style POST. Endpoint can be overridden via env.
        const endpoint = process.env.WHATSAPP_API_URL
          ?? "https://graph.facebook.com/v20.0/me/messages";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone.replace(/[^\d]/g, ""),
            type: "text",
            text: { body },
            from: SENDER_NUMBER,
          }),
        });
        if (!res.ok) {
          status = "failed";
          errorMsg = `HTTP ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 400);
        }
      } catch (e: any) {
        status = "failed";
        errorMsg = (e?.message ?? "send failed").slice(0, 400);
      }
    }
    // If no token, status stays "sent" (logged-only mode).

    const { data: logged, error: logErr } = await supabaseAdmin
      .from("whatsapp_messages")
      .insert({
        client_id: client.id,
        appointment_id: data.appointmentId ?? null,
        template_key: data.templateKey,
        message_type: data.templateKey,
        phone_number: phone,
        body,
        status,
        error: errorMsg,
      })
      .select("id")
      .single();
    if (logErr) dbError(logErr);

    return {
      ok: status === "sent" as const,
      messageId: logged?.id,
      status,
      error: errorMsg,
      tokenConfigured: !!token,
    };
  });
