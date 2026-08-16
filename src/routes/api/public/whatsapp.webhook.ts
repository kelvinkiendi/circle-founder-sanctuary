import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  — verification handshake (hub.challenge)
 * POST — delivery status updates + inbound messages (STOP / START opt-out handling)
 */
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge") ?? "";
        const expected = process.env.WHATSAPP_VERIFY_TOKEN;
        if (mode === "subscribe" && expected && token === expected) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const now = new Date().toISOString();
        let statuses = 0;
        let optOuts = 0;

        for (const entry of payload?.entry ?? []) {
          for (const change of entry?.changes ?? []) {
            const value = change?.value ?? {};

            // ----- Delivery status callbacks -----
            for (const st of value?.statuses ?? []) {
              const id = st?.id as string | undefined;
              if (!id) continue;
              const state = String(st?.status ?? "");
              const patch: Record<string, unknown> = {};
              if (state === "sent") patch.status = "sent";
              if (state === "delivered") { patch.status = "delivered"; patch.delivered_at = now; }
              if (state === "read") { patch.status = "read"; patch.read_at = now; }
              if (state === "failed") {
                patch.status = "failed";
                patch.error_message = String(st?.errors?.[0]?.title ?? "delivery failed").slice(0, 400);
              }
              if (Object.keys(patch).length === 0) continue;
              await supabaseAdmin.from("whatsapp_logs").update(patch as never).eq("meta_message_id", id);
              statuses++;
            }

            // ----- Inbound messages: STOP / START consent handling -----
            for (const msg of value?.messages ?? []) {
              const from = String(msg?.from ?? "").replace(/\D/g, "");
              const text = String(msg?.text?.body ?? "").trim().toUpperCase();
              if (!from) continue;
              const isStop = ["STOP", "UNSUBSCRIBE", "ACHA"].includes(text);
              const isStart = ["START", "SUBSCRIBE", "ANZA"].includes(text);
              if (!isStop && !isStart) continue;

              const tail = from.slice(-9);
              const { data: matches } = await supabaseAdmin
                .from("clients")
                .select("id")
                .or(`phone.ilike.%${tail},whatsapp_number.ilike.%${tail}`)
                .limit(5);

              for (const c of matches ?? []) {
                await supabaseAdmin
                  .from("clients")
                  .update({
                    whatsapp_opt_in: isStart,
                    whatsapp_opt_out: isStop,
                    whatsapp_opt_in_at: isStart ? now : null,
                  } as never)
                  .eq("id", c.id);
                optOuts++;
              }
            }
          }
        }

        return Response.json({ ok: true, statuses, consent_updates: optOuts });
      },
    },
  },
});
