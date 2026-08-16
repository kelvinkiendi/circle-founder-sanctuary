import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsApp } from "@/lib/whatsapp-provider.server";

export type DispatchResult = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  reasons: Record<string, number>;
};

/**
 * Sends every queued automation message (rows written by database triggers).
 * Safe to run repeatedly — each row is claimed by flipping its status first.
 */
export async function dispatchQueued(limit = 50): Promise<DispatchResult> {
  const { data: rows } = await supabaseAdmin
    .from("whatsapp_logs")
    .select("id, client_id, founder_id, recipient_phone, template_name, language, parameters")
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(limit);

  const res: DispatchResult = { processed: 0, sent: 0, failed: 0, skipped: 0, reasons: {} };

  for (const row of rows ?? []) {
    res.processed++;
    // Claim the row so a concurrent run cannot double-send.
    const { data: claimed } = await supabaseAdmin
      .from("whatsapp_logs")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claimed) { res.skipped++; continue; }

    const outcome = await sendWhatsApp({
      clientId: row.client_id,
      founderId: row.founder_id,
      phone: row.recipient_phone,
      templateName: row.template_name,
      language: row.language ?? "en",
      params: (row.parameters ?? {}) as Record<string, string>,
      createdBy: "automation",
      existingLogId: row.id,
    });

    if (outcome.status === "sent") res.sent++;
    else if (outcome.status === "failed") res.failed++;
    else {
      res.skipped++;
      const reason = outcome.reason ?? "skipped";
      res.reasons[reason] = (res.reasons[reason] ?? 0) + 1;
      await supabaseAdmin
        .from("whatsapp_logs")
        .update({ status: "failed", error_message: `skipped: ${reason}` })
        .eq("id", row.id);
    }
  }

  return res;
}
