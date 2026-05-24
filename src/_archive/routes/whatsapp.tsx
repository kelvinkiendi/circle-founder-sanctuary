import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppPanel } from "@/components/WhatsAppPanel";
import { WHATSAPP_TEMPLATES, getTemplate, type TemplateKey } from "@/lib/whatsapp-templates";


export function WhatsAppHub() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Concierge"
        title="WhatsApp · The Circle"
        description="Templates, single sends, and Founder broadcasts."
      />
      <Tabs defaultValue="compose">
        <TabsList className="mb-6">
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="broadcast">Bulk Broadcast</TabsTrigger>
          <TabsTrigger value="library">Template Library</TabsTrigger>
        </TabsList>
        <TabsContent value="compose"><ComposeTab /></TabsContent>
        <TabsContent value="broadcast"><BroadcastTab /></TabsContent>
        <TabsContent value="library"><LibraryTab /></TabsContent>
      </Tabs>
    </Layout>
  );
}

function ComposeTab() {
  const [founderId, setFounderId] = useState<string>("");
  const { data: founders } = useQuery({
    queryKey: ["founders-with-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("founder_circle").select("*, clients(*)").order("founder_number");
      return data || [];
    },
  });
  const selected = founders?.find((f: any) => f.id === founderId) || null;

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <div className="bg-card border border-border rounded-lg p-4 space-y-1 max-h-[600px] overflow-auto">
        <Label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 block">Recipient</Label>
        {(founders || []).map((f: any) => (
          <button
            key={f.id}
            onClick={() => setFounderId(f.id)}
            className={`w-full text-left p-2.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
              f.id === founderId ? "bg-secondary text-foreground" : "hover:bg-secondary/50 text-muted-foreground"
            }`}
          >
            <span className="font-display text-gold w-6">#{f.founder_number ?? "—"}</span>
            <span className="flex-1 truncate">{f.clients?.full_name}</span>
            {f.clients?.whatsapp_opt_out && <Badge variant="outline" className="text-[9px]">opt-out</Badge>}
          </button>
        ))}
        {(!founders || founders.length === 0) && (
          <div className="text-sm text-muted-foreground py-6 text-center">No founders yet.</div>
        )}
      </div>
      <div className="bg-card border border-border rounded-lg p-5">
        {selected ? <WhatsAppPanel founder={selected} /> : (
          <div className="text-sm text-muted-foreground text-center py-20">Select a founder to begin.</div>
        )}
      </div>
    </div>
  );
}

function BroadcastTab() {
  const qc = useQueryClient();
  const { data: founders } = useQuery({
    queryKey: ["broadcast-founders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_circle")
        .select("*, clients(*)")
        .eq("status", "active")
        .order("founder_number");
      return data || [];
    },
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [templateKey, setTemplateKey] = useState<TemplateKey>("priority_window");
  const tpl = getTemplate(templateKey);
  const [varState, setVarState] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const eligible = useMemo(
    () => (founders || []).filter((f: any) => !f.clients?.whatsapp_opt_out),
    [founders],
  );

  function toggleAll() {
    if (selected.size === eligible.length) setSelected(new Set());
    else setSelected(new Set(eligible.map((f: any) => f.id)));
  }

  async function broadcast() {
    if (selected.size === 0) return toast.error("Select at least one founder");
    setSending(true);
    const rows = Array.from(selected).map((id) => {
      const f = founders!.find((x: any) => x.id === id)!;
      const personalised = { name: f.clients?.full_name?.split(" ")[0] ?? "Founder", ...varState };
      return {
        client_id: f.client_id ?? f.clients?.id,
        template_key: templateKey,
        body: tpl.render(personalised),
        status: "sent" as const,
      };
    });
    const { error } = await supabase.from("whatsapp_messages").insert(rows);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(`Broadcast sent to ${rows.length} founders`);
    setSelected(new Set());
    qc.invalidateQueries();
  }

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gold" />
            <div className="font-display text-lg">Recipients</div>
            <Badge variant="outline">{selected.size} / {eligible.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {selected.size === eligible.length ? "Clear all" : "Select all"}
          </Button>
        </div>
        <div className="space-y-1 max-h-[480px] overflow-auto">
          {eligible.map((f: any) => {
            const checked = selected.has(f.id);
            return (
              <label
                key={f.id}
                className={`flex items-center gap-3 p-2.5 rounded-md text-sm cursor-pointer transition-colors ${
                  checked ? "bg-secondary" : "hover:bg-secondary/50"
                }`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const n = new Set(selected);
                    v ? n.add(f.id) : n.delete(f.id);
                    setSelected(n);
                  }}
                />
                <span className="font-display text-gold w-8">#{f.founder_number ?? "—"}</span>
                <span className="flex-1">{f.clients?.full_name}</span>
                <span className="text-xs text-muted-foreground">{f.clients?.whatsapp_number ?? "no number"}</span>
              </label>
            );
          })}
          {(founders || []).filter((f: any) => f.clients?.whatsapp_opt_out).map((f: any) => (
            <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-md text-sm opacity-50">
              <Checkbox checked={false} disabled />
              <span className="font-display text-gold w-8">#{f.founder_number}</span>
              <span className="flex-1">{f.clients?.full_name}</span>
              <Badge variant="outline" className="text-[10px]">opted out</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5 space-y-4 h-fit">
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Template</Label>
          <Select value={templateKey} onValueChange={(v) => { setTemplateKey(v as TemplateKey); setVarState({}); }}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WHATSAPP_TEMPLATES.map((t) => (
                <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tpl.variables.filter((vn) => vn !== "name").map((vn) => (
          <div key={vn}>
            <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{vn.replace(/_/g, " ")}</Label>
            <Input
              value={varState[vn] ?? ""}
              onChange={(e) => setVarState({ ...varState, [vn]: e.target.value })}
              className="mt-1"
            />
          </div>
        ))}
        <div>
          <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Preview (per recipient)</Label>
          <Textarea
            readOnly
            value={tpl.render({ name: "[FirstName]", ...varState })}
            className="mt-1 min-h-[140px] bg-secondary/40 font-mono text-[11px] leading-relaxed"
          />
        </div>
        <Button onClick={broadcast} disabled={sending || selected.size === 0} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Broadcast to {selected.size}
        </Button>
      </div>
    </div>
  );
}

function LibraryTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {WHATSAPP_TEMPLATES.map((t) => (
        <div key={t.key} className="bg-card border border-border rounded-lg p-5">
          <div className="font-display text-lg">{t.label}</div>
          <div className="text-xs text-muted-foreground mb-3">{t.description}</div>
          <div className="bg-secondary/40 rounded-md p-3 text-xs whitespace-pre-wrap leading-relaxed font-mono">
            {t.render(Object.fromEntries(t.variables.map((v) => [v, `[${v}]`])))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {t.variables.map((v) => (
              <Badge key={v} variant="outline" className="text-[10px]">{v}</Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
