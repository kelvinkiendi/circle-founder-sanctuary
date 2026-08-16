import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import { getWhatsAppStatusFn, dispatchQueuedFn } from "@/lib/whatsapp-api.functions";

export function WhatsAppSettings() {
  const { session } = useSession();
  const qc = useQueryClient();
  const status = useServerFn(getWhatsAppStatusFn);
  const dispatch = useServerFn(dispatchQueuedFn);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["wa-status", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => status({ data: { sessionId: session!.sessionId } }),
  });

  async function runDispatch() {
    if (!session) return;
    setBusy(true);
    try {
      const r = await dispatch({ data: { sessionId: session.sessionId, limit: 50 } });
      toast.success(`Queue processed — ${r.sent} sent, ${r.failed} failed, ${r.skipped} skipped`);
      qc.invalidateQueries({ queryKey: ["wa-status"] });
      qc.invalidateQueries({ queryKey: ["wa-logs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Dispatch failed");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading || !data) {
    return <div className="py-10 text-center text-muted-foreground text-sm">Loading connection…</div>;
  }

  const connected = data.connected;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-border bg-secondary/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {connected ? (
              <CheckCircle2 className="h-5 w-5 text-gold mt-0.5" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
            )}
            <div>
              <div className="font-display text-lg">
                {connected ? "WhatsApp Business connected" : "Log-only mode"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {connected
                  ? `Sending through ${data.provider === "meta" ? "Meta Cloud API" : "Twilio"} (API ${data.apiVersion}).`
                  : "Messages are composed, consent-checked and recorded, but not delivered until API credentials are configured. See README-WHATSAPP.md."}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-5 text-xs">
          <Row label="Provider" value={data.provider} />
          <Row label="Phone number ID" value={data.phoneNumberId ?? "not set"} ok={!!data.phoneNumberId} />
          <Row label="API token" value={data.hasToken ? "configured" : "missing"} ok={data.hasToken} />
          <Row label="Webhook verify token" value={data.hasVerifyToken ? "configured" : "missing"} ok={data.hasVerifyToken} />
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        <Stat label="Sent · 24h" value={data.sent24h} />
        <Stat label="Failed · 24h" value={data.failed24h} />
        <Stat label="Queued" value={data.queued} />
        <Stat label="Opted-in clients" value={data.optedInClients} />
      </div>

      <div className="rounded-xl border border-border p-5 space-y-3">
        <div className="font-display text-base">Automation queue</div>
        <p className="text-sm text-muted-foreground">
          Enrolments, bookings, cancellations, perks, surprises, brunch invites, payments and product
          pre-launches queue automatically. A scheduled job drains the queue; you can also run it now.
        </p>
        <Button onClick={runDispatch} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send queued messages
        </Button>
      </div>

      <div className="rounded-xl border border-border p-5 text-xs text-muted-foreground space-y-1">
        <div className="uppercase tracking-widest text-[10px] mb-2 text-foreground">Webhook URL</div>
        <code className="block bg-secondary/50 rounded px-3 py-2 break-all">
          {typeof window !== "undefined" ? `${window.location.origin}/api/public/whatsapp/webhook` : "/api/public/whatsapp/webhook"}
        </code>
        <p>
          Register this in Meta Business Manager for delivery receipts and STOP handling. Credentials
          live in server secrets only — they are never exposed to this browser.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-background/40 px-3 py-2">
      <span className="text-muted-foreground uppercase tracking-widest text-[10px]">{label}</span>
      <Badge variant={ok === false ? "outline" : "secondary"}>{value}</Badge>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1 text-gold">{value}</div>
    </div>
  );
}
