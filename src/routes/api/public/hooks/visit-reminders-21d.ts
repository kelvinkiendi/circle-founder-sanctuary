import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Daily cron — finds clients whose predicted next visit is today
// (i.e. exactly 21 days since their last appointment) and queues a
// WhatsApp reminder. Skips opted-out clients and de-dupes against any
// visit_reminder_21d sent in the last 21 days.
export const Route = createFileRoute("/api/public/hooks/visit-reminders-21d")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require Supabase anon key in apikey header (cron pattern)
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apikey || !expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const today = new Date().toISOString().slice(0, 10);

        const { data: clients, error } = await supabaseAdmin
          .from("clients")
          .select("id, full_name, whatsapp_number, phone, last_appointment_date, next_visit_predicted_date, whatsapp_opt_out, status")
          .eq("next_visit_predicted_date", today)
          .eq("whatsapp_opt_out", false)
          .eq("status", "active");

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const cutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
        let queued = 0;
        const skipped: string[] = [];

        for (const c of clients ?? []) {
          const wa = c.whatsapp_number || c.phone;
          if (!wa) { skipped.push(c.id); continue; }

          // De-dupe: skip if we already sent this template in the last 21 days
          const { count } = await supabaseAdmin
            .from("whatsapp_messages")
            .select("id", { count: "exact", head: true })
            .eq("client_id", c.id)
            .eq("template_key", "visit_reminder_21d")
            .gte("sent_at", cutoff);
          if ((count ?? 0) > 0) { skipped.push(c.id); continue; }

          const firstName = (c.full_name ?? "there").split(" ")[0];
          const lastDate = c.last_appointment_date
            ? new Date(c.last_appointment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : "your last visit";
          const body = `Hi ${firstName} ✨ It's been 3 weeks since your last sanctuary visit (${lastDate}). Your nails are likely ready for a refresh — reply to book your next session at COTERIE. — COTERIE 💅`;

          await supabaseAdmin.from("whatsapp_messages").insert({
            client_id: c.id,
            template_key: "visit_reminder_21d",
            body,
            status: "queued",
            created_by: "cron:visit-reminders-21d",
          });
          queued += 1;
        }

        return Response.json({
          success: true,
          date: today,
          candidates: clients?.length ?? 0,
          queued,
          skipped: skipped.length,
        });
      },
    },
  },
});
