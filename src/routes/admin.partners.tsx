import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, KeyRound, ShieldCheck, Copy } from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  listStaffFn,
  createStaffFn,
  setStaffActiveFn,
  deleteStaffFn,
} from "@/lib/admin-staff.functions";
import { setStaffPinFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/admin/partners")({
  component: () => (
    <RequireRole roles={["admin"]}>
      <Layout><PartnerManagement /></Layout>
    </RequireRole>
  ),
  ssr: false,
});

function PartnerManagement() {
  const { session } = useSession();
  const sessionId = session!.sessionId;
  const qc = useQueryClient();

  const list = useServerFn(listStaffFn);
  const create = useServerFn(createStaffFn);
  const toggle = useServerFn(setStaffActiveFn);
  const del = useServerFn(deleteStaffFn);
  const setPin = useServerFn(setStaffPinFn);

  const partnersQ = useQuery({
    queryKey: ["admin-partners", sessionId],
    queryFn: () => list({ data: { sessionId, role: "partner" } }),
  });

  const [form, setForm] = useState({ full_name: "", email: "", phone: "" });
  const [pinJustSet, setPinJustSet] = useState<{ id: string; pin: string } | null>(null);

  function genPin() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  const onboard = useMutation({
    mutationFn: async () => {
      if (form.full_name.trim().length < 2) throw new Error("Full name required");
      const created = await create({
        data: {
          sessionId,
          full_name: form.full_name.trim(),
          role: "partner",
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
      });
      const pin = genPin();
      const res = await setPin({ data: { sessionId, staffId: created.id, pin } });
      if (!res.ok) throw new Error("Created partner but failed to set initial PIN");
      return { id: created.id, pin };
    },
    onSuccess: ({ id, pin }) => {
      setPinJustSet({ id, pin });
      setForm({ full_name: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["admin-partners", sessionId] });
      toast.success("Partner created — share their starter PIN now");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create partner"),
  });

  const resetPin = useMutation({
    mutationFn: async (staffId: string) => {
      const pin = genPin();
      const res = await setPin({ data: { sessionId, staffId, pin } });
      if (!res.ok) throw new Error("Failed to reset PIN");
      return { id: staffId, pin };
    },
    onSuccess: ({ id, pin }) => {
      setPinJustSet({ id, pin });
      qc.invalidateQueries({ queryKey: ["admin-partners", sessionId] });
      toast.success("New PIN generated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setActive = useMutation({
    mutationFn: ({ staffId, active }: { staffId: string; active: boolean }) =>
      toggle({ data: { sessionId, staffId, active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-partners", sessionId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (staffId: string) => del({ data: { sessionId, staffId } }),
    onSuccess: () => {
      toast.success("Partner removed");
      qc.invalidateQueries({ queryKey: ["admin-partners", sessionId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="The Sanctuary · Admin"
        title="Partner Accounts"
        description="Onboard partner accounts with read-only access to reports and audits. Partners cannot add, edit, reschedule, or take any action."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-xl">
              <UserPlus className="h-4 w-4" /> Onboard a Partner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="optional" />
              </div>
            </div>
            <Button onClick={() => onboard.mutate()} disabled={onboard.isPending} className="w-full">
              <ShieldCheck className="h-4 w-4 mr-2" />
              {onboard.isPending ? "Creating…" : "Create Partner & Generate PIN"}
            </Button>
            <p className="text-xs text-muted-foreground">
              A 4-digit starter PIN is generated automatically. The partner must change it on first sign-in.
            </p>
          </CardContent>
        </Card>

        {pinJustSet && (
          <Card className="border-gold bg-gold/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl">
                <KeyRound className="h-4 w-4" /> Share this PIN now
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                This is shown once. Copy and deliver it to the partner securely.
              </p>
              <div className="flex items-center gap-3">
                <div className="font-mono text-4xl tracking-[0.4em] flex-1 text-center py-3 rounded bg-background border">
                  {pinJustSet.pin}
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(pinJustSet.pin);
                    toast.success("PIN copied");
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" /> Copy
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPinJustSet(null)} className="w-full">
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Partners</h2>
          <Badge variant="outline">{partnersQ.data?.length ?? 0} total</Badge>
        </div>

        <div className="space-y-2">
          {partnersQ.data?.map((p: any) => (
            <div key={p.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.email || "no email"} · {p.phone || "no phone"}
                  </div>
                </div>

                <Badge className="bg-primary/15 text-primary border-primary/30">partner</Badge>

                <Badge variant="outline" className={p.pin_set ? "text-emerald-700 border-emerald-300" : "text-amber-700 border-amber-300"}>
                  {p.pin_set ? (p.must_change_pin ? "PIN set (must change)" : "PIN set") : "No PIN"}
                </Badge>

                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={p.active}
                    onCheckedChange={(active) => setActive.mutate({ staffId: p.id, active })}
                  />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Active</span>
                </div>

                <Button variant="outline" size="sm" onClick={() => resetPin.mutate(p.id)}>
                  <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Reset PIN
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Permanently remove partner ${p.full_name}?`)) remove.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {p.last_login_at && (
                <div className="text-[11px] text-muted-foreground mt-2">
                  Last sign-in: {new Date(p.last_login_at).toLocaleString()}
                </div>
              )}
            </div>
          ))}
          {partnersQ.isSuccess && partnersQ.data.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground italic border rounded-lg">
              No partners yet. Onboard your first partner above.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
