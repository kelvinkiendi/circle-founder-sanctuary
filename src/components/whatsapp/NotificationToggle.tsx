import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";
import { getWhatsAppConsentFn, setWhatsAppConsentFn } from "@/lib/whatsapp-api.functions";

const CATEGORIES = [
  { key: "appointments", label: "Appointments", hint: "Bookings, reminders, cancellations" },
  { key: "perks", label: "Perks & surprises", hint: "Weekly refresh, gel rescue, surprises" },
  { key: "events", label: "Circle events", hint: "Founder brunches and invitations" },
  { key: "payments", label: "Payments", hint: "Receipts and balance reminders" },
  { key: "marketing", label: "Products & offers", hint: "Pre-launch access and promotions" },
] as const;

export function NotificationToggle({ clientId, compact }: { clientId: string; compact?: boolean }) {
  const { session } = useSession();
  const qc = useQueryClient();
  const get = useServerFn(getWhatsAppConsentFn);
  const set = useServerFn(setWhatsAppConsentFn);

  const { data } = useQuery({
    queryKey: ["wa-consent", clientId, session?.sessionId],
    enabled: !!clientId && !!session?.sessionId,
    queryFn: () => get({ data: { sessionId: session!.sessionId, clientId } }),
  });

  const optIn = !!data?.whatsapp_opt_in && !data?.whatsapp_opt_out;
  const prefs = (data?.whatsapp_prefs ?? {}) as Record<string, boolean>;

  async function update(payload: { optIn?: boolean; prefs?: Record<string, boolean> }) {
    if (!session) return;
    try {
      await set({ data: { sessionId: session.sessionId, clientId, ...(payload as any) } });
      qc.invalidateQueries({ queryKey: ["wa-consent", clientId] });
      toast.success("Preferences updated");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  }

  return (
    <div className={`rounded-xl border border-border p-4 space-y-4 ${compact ? "" : "max-w-xl"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-gold mt-0.5" />
          <div>
            <div className="font-display text-base">WhatsApp consent</div>
            <div className="text-xs text-muted-foreground">
              {optIn
                ? `Opted in${data?.whatsapp_opt_in_at ? ` · ${new Date(data.whatsapp_opt_in_at).toLocaleDateString("en-GB")}` : ""}`
                : "No consent on file — no messages will be sent."}
            </div>
          </div>
        </div>
        <Switch checked={optIn} onCheckedChange={(v) => update({ optIn: v })} />
      </div>

      <div className={`space-y-3 ${optIn ? "" : "opacity-50 pointer-events-none"}`}>
        {CATEGORIES.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">{c.label}</Label>
              <div className="text-[11px] text-muted-foreground">{c.hint}</div>
            </div>
            <Switch
              checked={prefs[c.key] !== false}
              onCheckedChange={(v) => update({ prefs: { [c.key]: v } })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
