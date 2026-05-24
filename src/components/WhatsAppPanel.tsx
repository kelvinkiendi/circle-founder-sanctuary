import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Check, CheckCheck, Eye, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { WHATSAPP_TEMPLATES, getTemplate, autoFillForFounder, type TemplateKey } from "@/lib/whatsapp-templates";

interface WhatsAppPanelProps {
  /** Single founder (with .clients) for personalised mode, or null for blank compose */
  founder?: any;
  compact?: boolean;
}

export function WhatsAppPanel({ founder, compact }: WhatsAppPanelProps) {
  const qc = useQueryClient();
  const clientId: string | null = founder?.client_id ?? founder?.clients?.id ?? null;
  const [templateKey, setTemplateKey] = useState<TemplateKey>("founder_welcome");
  const tpl = getTemplate(templateKey);

  const autofill = useMemo(() => (founder ? autoFillForFounder(founder) : {}), [founder]);
  const [vars, setVars] = useState<Record<string, string>>(autofill);
  const [overrideBody, setOverrideBody] = useState<string | null>(null);

  const merged = { ...autofill, ...vars };
  const body = overrideBody ?? tpl.render(merged);

  const optOut = founder?.clients?.whatsapp_opt_out ?? false;

  const { data: history } = useQuery({
    queryKey: ["whatsapp_messages", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("client_id", clientId!)
        .order("sent_at", { ascending: false })
        .limit(15);
      return data || [];
    },
  });

  const [sending, setSending] = useState(false);

  async function send() {
    if (!clientId) return toast.error("No recipient");
    if (optOut) return toast.error("This client has opted out of WhatsApp");
    setSending(true);
    const { error } = await supabase.from("whatsapp_messages").insert({
      client_id: clientId,
      template_key: templateKey,
      body,
      status: "sent",
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Message sent", { description: founder?.clients?.full_name });
    setOverrideBody(null);
    qc.invalidateQueries({ queryKey: ["whatsapp_messages", clientId] });
  }

  async function toggleOptOut(next: boolean) {
    if (!clientId) return;
    const { error } = await supabase.from("clients").update({ whatsapp_opt_out: next }).eq("id", clientId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries();
    toast.success(next ? "Client opted out" : "Client opted in");
  }

  return (
    <div className={`space-y-4 ${compact ? "" : "max-w-3xl"}`}>
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-gold" />
          <div className="font-display text-lg">WhatsApp · Business</div>
          {founder && <Badge variant="outline">{founder.clients?.full_name}</Badge>}
        </div>
        {founder && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Opted in</span>
            <Switch checked={!optOut} onCheckedChange={(v) => toggleOptOut(!v)} />
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Template</Label>
            <Select value={templateKey} onValueChange={(v) => { setTemplateKey(v as TemplateKey); setOverrideBody(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WHATSAPP_TEMPLATES.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">{tpl.description}</div>
          </div>

          {tpl.variables.map((vn) => (
            <div key={vn} className="space-y-1">
              <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{vn.replace(/_/g, " ")}</Label>
              <Input
                value={vars[vn] ?? autofill[vn] ?? ""}
                onChange={(e) => { setVars({ ...vars, [vn]: e.target.value }); setOverrideBody(null); }}
                placeholder={autofill[vn] ?? ""}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Preview</Label>
          <Textarea
            value={body}
            onChange={(e) => setOverrideBody(e.target.value)}
            className="min-h-[220px] bg-secondary/40 font-mono text-xs leading-relaxed"
          />
          <Button onClick={send} disabled={sending || !clientId || optOut} className="w-full">
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {optOut ? "Recipient opted out" : "Send via WhatsApp"}
          </Button>
          <div className="text-[10px] text-muted-foreground text-center">
            Logged to message ledger. Real WhatsApp Business API delivery pending integration.
          </div>
        </div>
      </div>

      {founder && (
        <div className="pt-4 border-t border-border">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Chat history</Label>
          {!history || history.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No messages yet.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {history.map((m: any) => (
                <div key={m.id} className="bg-secondary/40 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                      {getTemplate(m.template_key)?.label ?? m.template_key}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.body}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(m.sent_at).toLocaleString("en-GB")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string }> = {
    sent: { icon: Check, cls: "text-muted-foreground" },
    delivered: { icon: CheckCheck, cls: "text-foreground" },
    read: { icon: Eye, cls: "text-gold" },
    failed: { icon: Check, cls: "text-destructive" },
  };
  const m = map[status] ?? map.sent;
  const I = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${m.cls}`}>
      <I className="h-3 w-3" /> {status}
    </span>
  );
}
