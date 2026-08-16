import { createFileRoute } from "@tanstack/react-router";
import { dispatchQueued } from "@/lib/whatsapp-dispatch.server";

/**
 * Cron endpoint — sends every WhatsApp message queued by database automation
 * triggers (enrolment, appointments, perks, surprises, brunch, payments,
 * product pre-launch). Protected by CRON_SECRET.
 */
export const Route = createFileRoute("/api/public/hooks/whatsapp-dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.CRON_SECRET;
        const authHeader = request.headers.get("authorization") ?? "";
        const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
        const provided = bearer || request.headers.get("x-cron-secret") || request.headers.get("apikey") || "";
        if (!expected || !provided || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await dispatchQueued(50);
          return Response.json({ ok: true, ...result });
        } catch (e) {
          console.error("[whatsapp-dispatch]", (e as Error)?.message);
          return Response.json({ ok: false, error: "dispatch failed" }, { status: 500 });
        }
      },
    },
  },
});
