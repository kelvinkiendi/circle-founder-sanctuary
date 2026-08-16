import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, Eye, XCircle, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/lib/session";
import { listWhatsAppLogsFn, listWhatsAppTemplatesFn } from "@/lib/whatsapp-api.functions";

const EAT = "Africa/Nairobi";
const fmt = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: EAT, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
      }) + " EAT"
    : "—";

export function MessageLogs({ clientId }: { clientId?: string }) {
  const { session } = useSession();
  const logs = useServerFn(listWhatsAppLogsFn);
  const templates = useServerFn(listWhatsAppTemplatesFn);

  const [status, setStatus] = useState<string>("all");
  const [template, setTemplate] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: tplRows } = useQuery({
    queryKey: ["wa-templates", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => templates({ data: { sessionId: session!.sessionId } }),
  });

  const templateNames = useMemo(
    () => Array.from(new Set((tplRows ?? []).map((t: any) => t.template_name))).sort(),
    [tplRows],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["wa-logs", session?.sessionId, clientId, status, template, from, to],
    enabled: !!session?.sessionId,
    queryFn: () =>
      logs({
        data: {
          sessionId: session!.sessionId,
          clientId: clientId ?? null,
          status: status === "all" ? null : (status as any),
          templateName: template === "all" ? null : template,
          from: from || null,
          to: to || null,
          limit: 150,
        },
      }),
  });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "queued", "sent", "delivered", "read", "failed"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Template</Label>
          <Select value={template} onValueChange={setTemplate}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              {templateNames.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading messages…</div>
      ) : !data || data.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">No messages match these filters.</div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="max-h-[520px] overflow-auto divide-y divide-border">
            {data.map((m: any) => (
              <div key={m.id} className="p-4 hover:bg-secondary/30 transition-colors">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{m.clients?.full_name ?? m.recipient_phone}</span>
                    <Badge variant="outline" className="text-[10px]">{m.template_name}</Badge>
                    <Badge variant="secondary" className="text-[10px] uppercase">{m.language}</Badge>
                  </div>
                  <StatusPill status={m.status} />
                </div>
                {m.body_text && (
                  <div className="text-xs whitespace-pre-wrap leading-relaxed text-muted-foreground">{m.body_text}</div>
                )}
                <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                  <span>Queued {fmt(m.queued_at)}</span>
                  {m.sent_at && <span>Sent {fmt(m.sent_at)}</span>}
                  {m.delivered_at && <span>Delivered {fmt(m.delivered_at)}</span>}
                  {m.read_at && <span>Read {fmt(m.read_at)}</span>}
                  <span>{m.recipient_phone}</span>
                </div>
                {m.error_message && (
                  <div className="mt-1 text-[11px] text-destructive">{m.error_message}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string }> = {
    queued: { icon: Clock, cls: "text-muted-foreground" },
    sending: { icon: Clock, cls: "text-muted-foreground" },
    sent: { icon: Check, cls: "text-foreground" },
    delivered: { icon: CheckCheck, cls: "text-foreground" },
    read: { icon: Eye, cls: "text-gold" },
    failed: { icon: XCircle, cls: "text-destructive" },
  };
  const m = map[status] ?? map.queued;
  const I = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest ${m.cls}`}>
      <I className="h-3.5 w-3.5" /> {status}
    </span>
  );
}
