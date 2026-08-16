import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/session";
import {
  listWhatsAppTemplatesFn,
  setTemplateActiveFn,
  updateTemplateBodyFn,
  testSendFn,
} from "@/lib/whatsapp-api.functions";

type Tpl = {
  id: string;
  template_name: string;
  category: string;
  language: string;
  body_text: string;
  variables: string[];
  is_active: boolean;
  is_critical: boolean;
};

function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => vars[k] || `[${k}]`);
}

export function TemplateManager() {
  const { session } = useSession();
  const qc = useQueryClient();
  const list = useServerFn(listWhatsAppTemplatesFn);
  const setActive = useServerFn(setTemplateActiveFn);
  const updateBody = useServerFn(updateTemplateBodyFn);
  const test = useServerFn(testSendFn);

  const isAdmin = session?.role === "admin" || session?.role === "manager";

  const { data, isLoading } = useQuery({
    queryKey: ["wa-templates", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => list({ data: { sessionId: session!.sessionId } }),
  });

  const templates = (data ?? []) as Tpl[];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? templates[0] ?? null,
    [templates, selectedId],
  );

  const [vars, setVars] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  if (isLoading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading templates…</div>;
  if (!selected) return <div className="py-10 text-center text-sm text-muted-foreground">No templates yet.</div>;

  const body = draft ?? selected.body_text;

  async function toggle(t: Tpl, next: boolean) {
    if (!session) return;
    try {
      await setActive({ data: { sessionId: session.sessionId, id: t.id, isActive: next } });
      qc.invalidateQueries({ queryKey: ["wa-templates"] });
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
  }

  async function save() {
    if (!session || !selected) return;
    setSaving(true);
    try {
      await updateBody({ data: { sessionId: session.sessionId, id: selected.id, bodyText: body } });
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["wa-templates"] });
      toast.success("Template saved");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSaving(false); }
  }

  async function testSend() {
    if (!session || !selected) return;
    if (!phone) return toast.error("Enter a test number (+2547…)");
    setSending(true);
    try {
      const r = await test({
        data: {
          sessionId: session.sessionId,
          phone,
          templateName: selected.template_name,
          language: selected.language,
          params: vars,
        },
      });
      if (r.ok) toast.success("Test message sent");
      else toast.error(r.error ?? r.reason ?? "Not sent");
    } catch (e: any) { toast.error(e?.message ?? "Failed"); }
    finally { setSending(false); }
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-6">
      <div className="rounded-xl border border-border divide-y divide-border max-h-[560px] overflow-auto">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => { setSelectedId(t.id); setDraft(null); setVars({}); }}
            className={`w-full text-left p-3 hover:bg-secondary/40 transition-colors ${t.id === selected.id ? "bg-secondary/60" : ""}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{t.template_name}</span>
              <Badge variant="secondary" className="text-[10px] uppercase">{t.language}</Badge>
            </div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {t.category}{t.is_critical ? " · critical" : ""}{t.is_active ? "" : " · off"}
            </div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-display text-lg">{selected.template_name}</div>
            <div className="text-xs text-muted-foreground">
              {selected.category} · {selected.language.toUpperCase()} · {selected.variables?.length ?? 0} variables
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Active</span>
              <Switch checked={selected.is_active} onCheckedChange={(v) => toggle(selected, v)} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Body</Label>
          <Textarea
            value={body}
            readOnly={!isAdmin}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[120px] font-mono text-xs bg-secondary/40"
          />
          {isAdmin && draft !== null && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-2" />}
              Save body
            </Button>
          )}
        </div>

        {(selected.variables ?? []).length > 0 && (
          <div className="grid sm:grid-cols-2 gap-3">
            {(selected.variables ?? []).map((vn) => (
              <div key={vn} className="space-y-1">
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{vn}</Label>
                <Input value={vars[vn] ?? ""} onChange={(e) => setVars({ ...vars, [vn]: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Preview</div>
          <div className="text-sm whitespace-pre-wrap leading-relaxed">{render(body, vars)}</div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Test number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254722000000" className="w-56" />
            </div>
            <Button onClick={testSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Test send
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
