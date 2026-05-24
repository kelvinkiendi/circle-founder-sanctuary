import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Pencil, Trash2, Plus, ArrowUp, ArrowDown, Search } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = ["manicure", "pedicure", "gel", "nail_art", "treatment", "add-on"] as const;
const ROLES = ["admin", "manager", "technician", "reception"] as const;

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_ksh: number;
  category: string;
  description: string | null;
  status: "active" | "inactive";
  eligible_roles: string[];
  display_order: number;
};

const empty: Omit<Service, "id"> = {
  name: "",
  duration_minutes: 30,
  price_ksh: 0,
  category: "manicure",
  description: "",
  status: "active",
  eligible_roles: ["admin", "manager", "technician", "reception"],
  display_order: 0,
};

export function ServicesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: services = [] } = useQuery({
    queryKey: ["services-admin"],
    queryFn: async (): Promise<Service[]> => {
      const { data } = await (supabase as any)
        .from("services").select("*").order("display_order").order("name");
      return (data ?? []) as Service[];
    },
  });

  const filtered = services.filter((s) =>
    (cat === "all" || s.category === cat) &&
    (!q.trim() || s.name.toLowerCase().includes(q.toLowerCase())),
  );

  const reorder = useMutation({
    mutationFn: async ({ id, dir }: { id: string; dir: -1 | 1 }) => {
      const idx = services.findIndex((s) => s.id === id);
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= services.length) return;
      const a = services[idx], b = services[swapIdx];
      await (supabase as any).from("services").update({ display_order: b.display_order }).eq("id", a.id);
      await (supabase as any).from("services").update({ display_order: a.display_order }).eq("id", b.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services-admin"] }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("services").update({ status: "inactive" }).eq("id", id);
    },
    onSuccess: () => { toast.success("Service archived"); qc.invalidateQueries({ queryKey: ["services-admin"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search services…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setCreating(true)} className="gap-2"><Plus className="h-4 w-4" /> New Service</Button>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Category</th>
              <th className="text-right p-3">Duration</th>
              <th className="text-right p-3">Price</th>
              <th className="text-right p-3">Founder</th>
              <th className="text-left p-3">Roles</th>
              <th className="text-left p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((s) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 capitalize">{s.category}</td>
                <td className="p-3 text-right">{s.duration_minutes}m</td>
                <td className="p-3 text-right">KSH {Number(s.price_ksh).toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">KSH {Math.round(Number(s.price_ksh) * 0.85).toLocaleString()}</td>
                <td className="p-3"><div className="flex gap-1 flex-wrap">{s.eligible_roles.map((r) => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}</div></td>
                <td className="p-3"><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => reorder.mutate({ id: s.id, dir: -1 })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => reorder.mutate({ id: s.id, dir: 1 })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Archive "${s.name}"?`)) softDelete.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={8} className="p-8 text-center text-muted-foreground italic">No services match.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(editing || creating) && (
        <ServiceDialog
          initial={editing ?? { ...empty, id: "" } as Service}
          isNew={creating}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ["services-admin"] }); }}
        />
      )}
    </div>
  );
}

function ServiceDialog({ initial, isNew, onClose, onSaved }: { initial: Service; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<Service>(initial);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!s.name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    try {
      const payload = {
        name: s.name.trim(),
        duration_minutes: s.duration_minutes,
        price_ksh: s.price_ksh,
        category: s.category,
        description: s.description || null,
        status: s.status,
        eligible_roles: s.eligible_roles,
        display_order: s.display_order,
      };
      if (isNew) {
        const { error } = await (supabase as any).from("services").insert(payload);
        if (error) throw error;
        toast.success("Service created");
      } else {
        const { error } = await (supabase as any).from("services").update(payload).eq("id", s.id);
        if (error) throw error;
        toast.success("Service updated");
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const toggleRole = (r: string) => {
    setS({ ...s, eligible_roles: s.eligible_roles.includes(r) ? s.eligible_roles.filter((x) => x !== r) : [...s.eligible_roles, r] });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isNew ? "New Service" : `Edit · ${initial.name}`}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Duration (min)</Label><Input type="number" value={s.duration_minutes} onChange={(e) => setS({ ...s, duration_minutes: Number(e.target.value) })} /></div>
            <div><Label>Price (KSH)</Label><Input type="number" value={s.price_ksh} onChange={(e) => setS({ ...s, price_ksh: Number(e.target.value) })} /></div>
          </div>
          <div className="text-xs text-muted-foreground">Founder rate (auto): KSH {Math.round(Number(s.price_ksh) * 0.85).toLocaleString()}</div>
          <div>
            <Label>Category</Label>
            <Select value={s.category} onValueChange={(v) => setS({ ...s, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Textarea rows={2} value={s.description ?? ""} onChange={(e) => setS({ ...s, description: e.target.value })} /></div>
          <div>
            <Label>Eligible Roles</Label>
            <div className="flex gap-2 flex-wrap mt-1">
              {ROLES.map((r) => (
                <button key={r} type="button" onClick={() => toggleRole(r)}
                  className={`px-3 py-1.5 rounded text-xs border ${s.eligible_roles.includes(r) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}>{r}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Label htmlFor="active">Active</Label>
            <Switch id="active" checked={s.status === "active"} onCheckedChange={(v) => setS({ ...s, status: v ? "active" : "inactive" })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
