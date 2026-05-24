import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Sliders,
  Users,
  Bell,
  Database,
  MapPin,
  Plug,
  Save,
  Plus,
  Trash2,
  Download,
  Upload,
  RotateCw,
  Activity,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { ServiceAreaMap } from "@/components/ServiceAreaMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// ---------- Helpers ----------
function useSetting<T = any>(key: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["app_settings", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as T;
    },
  });
  const save = useMutation({
    mutationFn: async (value: T) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value as any, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings", key] });
      toast.success("Saved");
    },
    onError: (e: any) => toast.error(e.message),
  });
  return { ...query, save };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div>
        <h3 className="font-display text-lg tracking-wide">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ---------- Page ----------
export function SettingsPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="The Rule Book"
        title="Admin Settings & Infrastructure"
        description="Business identity, Circle rules, staff, notifications, data, locations, integrations."
      />
      <Tabs defaultValue="business">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="business"><Building2 className="h-3.5 w-3.5 mr-1.5" />Business</TabsTrigger>
          <TabsTrigger value="rules"><Sliders className="h-3.5 w-3.5 mr-1.5" />Circle Rules</TabsTrigger>
          <TabsTrigger value="staff"><Users className="h-3.5 w-3.5 mr-1.5" />Staff</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="h-3.5 w-3.5 mr-1.5" />Notifications</TabsTrigger>
          <TabsTrigger value="data"><Database className="h-3.5 w-3.5 mr-1.5" />Data</TabsTrigger>
          <TabsTrigger value="locations"><MapPin className="h-3.5 w-3.5 mr-1.5" />Locations</TabsTrigger>
          <TabsTrigger value="integrations"><Plug className="h-3.5 w-3.5 mr-1.5" />Integrations</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1.5" />Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="business"><BusinessTab /></TabsContent>
        <TabsContent value="rules"><RulesTab /></TabsContent>
        <TabsContent value="staff"><StaffTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="data"><DataTab /></TabsContent>
        <TabsContent value="locations"><LocationsTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="activity"><ActivityTab /></TabsContent>
      </Tabs>
    </Layout>
  );
}

// ---------- BUSINESS ----------
function BusinessTab() {
  const { data, save } = useSetting<any>("business");
  const { data: hours, save: saveHours } = useSetting<any>("hours");
  const [b, setB] = useState<any>({});
  const [h, setH] = useState<any>({});
  useEffect(() => { if (data) setB(data); }, [data]);
  useEffect(() => { if (hours) setH(hours); }, [hours]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Section title="Business Info" description="Shown on receipts, WhatsApp templates, header.">
        <Field label="Business Name"><Input value={b.name || ""} onChange={(e) => setB({ ...b, name: e.target.value })} /></Field>
        <Field label="Address"><Textarea value={b.address || ""} onChange={(e) => setB({ ...b, address: e.target.value })} rows={2} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={b.phone || ""} onChange={(e) => setB({ ...b, phone: e.target.value })} /></Field>
          <Field label="Email"><Input value={b.email || ""} onChange={(e) => setB({ ...b, email: e.target.value })} /></Field>
        </div>
        <Field label="Tax PIN"><Input value={b.tax_pin || ""} onChange={(e) => setB({ ...b, tax_pin: e.target.value })} /></Field>
        <Button onClick={() => save.mutate(b)} className="w-full"><Save className="h-4 w-4 mr-2" />Save Business Info</Button>
      </Section>

      <Section title="Brand & Identity">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Primary (Brown)">
            <div className="flex gap-2">
              <input type="color" value={b.brand_primary || "#5D4037"} onChange={(e) => setB({ ...b, brand_primary: e.target.value })} className="h-9 w-12 rounded border" />
              <Input value={b.brand_primary || ""} onChange={(e) => setB({ ...b, brand_primary: e.target.value })} />
            </div>
          </Field>
          <Field label="Accent (Cream)">
            <div className="flex gap-2">
              <input type="color" value={b.brand_accent || "#F5F5DC"} onChange={(e) => setB({ ...b, brand_accent: e.target.value })} className="h-9 w-12 rounded border" />
              <Input value={b.brand_accent || ""} onChange={(e) => setB({ ...b, brand_accent: e.target.value })} />
            </div>
          </Field>
        </div>
        <Field label="Logo">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const ext = file.name.split(".").pop() || "png";
                  const path = `logo-${Date.now()}.${ext}`;
                  const { error: upErr } = await supabase.storage
                    .from("brand-assets")
                    .upload(path, file, { upsert: true, contentType: file.type });
                  if (upErr) { toast.error(upErr.message); return; }
                  const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
                  setB({ ...b, logo_url: pub.publicUrl });
                  toast.success("Logo uploaded — click Save Brand to persist");
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("logo-upload")?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />Upload Logo
              </Button>
              <Input
                placeholder="…or paste image URL"
                value={b.logo_url || ""}
                onChange={(e) => setB({ ...b, logo_url: e.target.value })}
              />
            </div>
            {b.logo_url && (
              <img src={b.logo_url} alt="Logo" className="h-20 object-contain rounded border bg-muted p-2" />
            )}
          </div>
        </Field>
        <Button onClick={() => save.mutate(b)} variant="outline" className="w-full"><Save className="h-4 w-4 mr-2" />Save Brand</Button>
      </Section>

      <Section title="Operating Hours">
        {(["mon","tue","wed","thu","fri","sat","sun"] as const).map((day) => {
          const closed = !!h[`${day}_closed`];
          const label = { mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun" }[day];
          return (
            <div key={day} className="flex items-center gap-3 rounded-lg border p-2">
              <div className="w-12 text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</div>
              <Input type="time" disabled={closed} value={h[`${day}_open`] || ""} onChange={(e) => setH({ ...h, [`${day}_open`]: e.target.value })} className="flex-1" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="time" disabled={closed} value={h[`${day}_close`] || ""} onChange={(e) => setH({ ...h, [`${day}_close`]: e.target.value })} className="flex-1" />
              <div className="flex items-center gap-1.5">
                <Switch checked={closed} onCheckedChange={(v) => setH({ ...h, [`${day}_closed`]: v })} />
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Closed</span>
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label>After-hours emergency availability</Label>
            <p className="text-xs text-muted-foreground">Allow emergency bookings outside studio hours.</p>
          </div>
          <Switch checked={!!h.after_hours_emergency} onCheckedChange={(v) => setH({ ...h, after_hours_emergency: v })} />
        </div>
        <Button onClick={() => saveHours.mutate(h)} className="w-full"><Save className="h-4 w-4 mr-2" />Save Hours</Button>
      </Section>

      <Section title="Service Area" description="Core zone is included. Extended zone adds transport charge.">
        <ServiceAreaEditor />
      </Section>
    </div>
  );
}

function ServiceAreaEditor() {
  const { data, save } = useSetting<any>("service_area");
  const [v, setV] = useState<any>({});
  useEffect(() => { if (data) setV(data); }, [data]);
  return (
    <>
      <Field label="Core Zones (free)">
        <Textarea
          rows={2}
          value={(v.core_zones || []).join(", ")}
          onChange={(e) => setV({ ...v, core_zones: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      <Field label="Extended Zones (transport charge)">
        <Textarea
          rows={2}
          value={(v.extended_zones || []).join(", ")}
          onChange={(e) => setV({ ...v, extended_zones: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
      </Field>
      <Field label="Transport Charge (KSH)">
        <Input type="number" value={v.transport_charge ?? ""} onChange={(e) => setV({ ...v, transport_charge: Number(e.target.value) })} />
      </Field>
      <ServiceAreaMap
        corePolygon={v.core_polygon || []}
        extendedPolygon={v.extended_polygon || []}
        onChange={({ core, extended }) => setV({ ...v, core_polygon: core, extended_polygon: extended })}
      />
      <Button onClick={() => save.mutate(v)} className="w-full"><Save className="h-4 w-4 mr-2" />Save Service Area</Button>
    </>
  );
}

// ---------- RULES ----------
function RulesTab() {
  const { data, save } = useSetting<any>("founder_rules");
  const [r, setR] = useState<any>({});
  useEffect(() => { if (data) setR(data); }, [data]);

  const num = (k: string) => (
    <Input type="number" value={r[k] ?? ""} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} />
  );
  const bool = (k: string, label: string) => (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label>{label}</Label>
      <Switch checked={!!r[k]} onCheckedChange={(v) => setR({ ...r, [k]: v })} />
    </div>
  );

  return (
    <div className="space-y-6">
      <Section title="Membership Terms">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Max Founders">{num("max_founders")}</Field>
          <Field label="Term (months)">{num("term_months")}</Field>
          <Field label="Enrollment Fee (KSH)">{num("enrollment_fee")}</Field>
          <Field label="Founder Rate Discount (%)">{num("founder_rate_discount")}</Field>
        </div>
        <Field label="Installment Options">
          <Input
            value={(r.installments || []).join(", ")}
            onChange={(e) => setR({ ...r, installments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="full, 2, 3"
          />
        </Field>
        <Field label="Active Relationship (months — for Founder Rate)">{num("active_relationship_months")}</Field>
      </Section>

      <Section title="Weekly Refresh">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Reschedule limit / week">{num("weekly_reschedule_limit")}</Field>
          {bool("weekly_noshow_forfeit", "No-show forfeits refresh")}
          {bool("weekly_carryover", "Carryover to next week")}
        </div>
      </Section>

      <Section title="Gel Rescue">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Window (days)">{num("gel_rescue_days")}</Field>
          {bool("gel_negligence_charges", "Negligence charges Founder Rate re-service")}
        </div>
      </Section>

      <Section title="Travel Touch-Up">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Monthly limit">{num("travel_monthly_limit")}</Field>
          <Field label="Max duration (min)">{num("travel_duration_max")}</Field>
          <Field label="Transport (KSH)">{num("travel_transport_charge")}</Field>
        </div>
      </Section>

      <Section title="Birthday Sanctuary">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Days before birthday">{num("birthday_days_before")}</Field>
          <Field label="Days after birthday">{num("birthday_days_after")}</Field>
        </div>
      </Section>

      <Section title="Surprise Moments">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Surprise Full / term">{num("surprise_full_max")}</Field>
          <Field label="Random Upgrade / term">{num("upgrade_max")}</Field>
          <Field label="Upgrade dedup days">{num("upgrade_dedup_days")}</Field>
        </div>
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Just Because — Top N criteria weights</Label>
          <div className="grid md:grid-cols-4 gap-3">
            <Field label="Top N founders">{num("just_because_top_n")}</Field>
            <Field label="Weight: spend">{num("weight_spend")}</Field>
            <Field label="Weight: referrals">{num("weight_referrals")}</Field>
            <Field label="Weight: engagement">{num("weight_engagement")}</Field>
          </div>
          <p className="text-[10px] text-muted-foreground">Weights should sum to ~1.0</p>
        </div>
      </Section>

      <Button onClick={() => save.mutate(r)} size="lg" className="w-full">
        <Save className="h-4 w-4 mr-2" />Save All Founder Rules
      </Button>
    </div>
  );
}

// ---------- STAFF ----------
function StaffTab() {
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ full_name: "", role: "technician", pin: "", email: "", phone: "" });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.full_name) throw new Error("Name required");
      if (form.pin && !/^\d{4}$/.test(form.pin)) throw new Error("PIN must be 4 digits");
      // Insert staff WITHOUT the plain pin column — we hash it via RPC below
      const { data: created, error } = await supabase
        .from("staff")
        .insert({
          full_name: form.full_name,
          role: form.role as any,
          email: form.email || null,
          phone: form.phone || null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      if (form.pin) {
        const { setStaffPinFn } = await import("@/lib/auth.functions");
        const res = await setStaffPinFn({ data: { staffId: created.id, pin: form.pin } });
        if (!res.ok) throw new Error("Failed to set PIN");
      }
    },
    onSuccess: () => {
      toast.success("Staff added — PIN is live on the login screen");
      setForm({ full_name: "", role: "technician", pin: "", email: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: any) => {
      const { error } = await supabase.from("staff").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
  });

  const setPin = useMutation({
    mutationFn: async ({ id, pin }: { id: string; pin: string }) => {
      if (!/^\d{4}$/.test(pin)) throw new Error("PIN must be 4 digits");
      const { setStaffPinFn } = await import("@/lib/auth.functions");
      const res = await setStaffPinFn({ data: { staffId: id, pin } });
      if (!res.ok) throw new Error("Failed to set PIN");
    },
    onSuccess: () => {
      toast.success("PIN updated — active on the login screen");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const roleColors: Record<string, string> = {
    admin: "bg-primary/20 text-primary",
    manager: "bg-amber-100 text-amber-800",
    technician: "bg-emerald-100 text-emerald-800",
    reception: "bg-sky-100 text-sky-800",
  };

  return (
    <div className="space-y-6">
      <Section title="Add Staff Member" description="Setting a 4-digit PIN here makes it immediately usable on the login screen.">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Full Name"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access</SelectItem>
                <SelectItem value="manager">Manager — reports + settings</SelectItem>
                <SelectItem value="technician">Technician — mobile view</SelectItem>
                <SelectItem value="reception">Reception — booking only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="PIN (4 digits)"><Input maxLength={4} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "") })} /></Field>
          <Field label="Email"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        </div>
        <Button onClick={() => add.mutate()}><Plus className="h-4 w-4 mr-2" />Add Staff</Button>
      </Section>

      <Section title="Team" description="Toggle access, reset PINs (login-ready), and set commission rates per technician.">
        <div className="space-y-2">
          {(staff as any[]).map((s) => (
            <StaffRow
              key={s.id}
              staff={s}
              roleClass={roleColors[s.role] || ""}
              onToggle={(active) => toggle.mutate({ id: s.id, active })}
              onDelete={() => del.mutate(s.id)}
              onSetPin={(pin) => setPin.mutate({ id: s.id, pin })}
            />
          ))}
          {staff.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No staff yet.</p>}
        </div>
      </Section>
    </div>
  );
}

function StaffRow({ staff, roleClass, onToggle, onDelete, onSetPin }: {
  staff: any;
  roleClass: string;
  onToggle: (active: boolean) => void;
  onDelete: () => void;
  onSetPin: (pin: string) => void;
}) {
  const [newPin, setNewPin] = useState("");
  const [showCommission, setShowCommission] = useState(false);
  const pinSet = !!staff.pin_hash;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 p-3">
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{staff.full_name}</div>
          <div className="text-xs text-muted-foreground">
            {staff.email || "—"} ·{" "}
            <span className={pinSet ? "text-emerald-700" : "text-amber-700"}>
              {pinSet ? "PIN set" : "No PIN"}
            </span>
            {staff.must_change_pin && pinSet && <span className="ml-1 text-amber-700">(must change)</span>}
          </div>
        </div>
        <Badge className={roleClass}>{staff.role}</Badge>
        <Switch checked={staff.active} onCheckedChange={onToggle} />
        <Button variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="px-3 pb-3 flex flex-wrap gap-2 items-center border-t pt-3">
        <Input
          className="w-28"
          maxLength={4}
          placeholder="New PIN"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={newPin.length !== 4}
          onClick={() => { onSetPin(newPin); setNewPin(""); }}
        >
          Set login PIN
        </Button>
        {staff.role === "technician" && (
          <Button size="sm" variant="ghost" onClick={() => setShowCommission((v) => !v)}>
            {showCommission ? "Hide" : "Commission"}
          </Button>
        )}
      </div>
      {showCommission && staff.role === "technician" && (
        <CommissionEditor staffId={staff.id} />
      )}
    </div>
  );
}

function CommissionEditor({ staffId }: { staffId: string }) {
  const qc = useQueryClient();
  const { data: current } = useQuery({
    queryKey: ["commission-active", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_commission_settings")
        .select("*")
        .eq("staff_id", staffId)
        .eq("is_active", true)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  const { data: history = [] } = useQuery({
    queryKey: ["commission-history", staffId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_commission_settings")
        .select("id, commission_percentage, commission_type, fixed_amount_ksh, effective_date, notes, created_at")
        .eq("staff_id", staffId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const [pct, setPct] = useState<string>("");
  const [type, setType] = useState<string>("percentage_of_sale");
  const [fixed, setFixed] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    setPct(String(current?.commission_percentage ?? 0));
    setType((current?.commission_type as string) ?? "percentage_of_sale");
    setFixed(String(current?.fixed_amount_ksh ?? 0));
  }, [current]);

  const save = useMutation({
    mutationFn: async () => {
      // Deactivate prior settings, insert new active row
      await supabase.from("staff_commission_settings").update({ is_active: false }).eq("staff_id", staffId).eq("is_active", true);
      const { error } = await supabase.from("staff_commission_settings").insert({
        staff_id: staffId,
        commission_percentage: Number(pct) || 0,
        commission_type: type,
        fixed_amount_ksh: Number(fixed) || 0,
        notes: notes || null,
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commission rate updated");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["commission-active", staffId] });
      qc.invalidateQueries({ queryKey: ["commission-history", staffId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="px-3 pb-3 border-t bg-muted/30 space-y-3 pt-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Field label="Rate %">
          <Input type="number" min={0} max={100} value={pct} onChange={(e) => setPct(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage_of_sale">% of sale</SelectItem>
              <SelectItem value="fixed_per_service">Fixed / service</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fixed KSH">
          <Input type="number" min={0} value={fixed} onChange={(e) => setFixed(e.target.value)} />
        </Field>
        <Field label="Notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="reason for change" />
        </Field>
      </div>
      <Button size="sm" onClick={() => save.mutate()}>
        <Save className="h-4 w-4 mr-2" /> Save commission rate
      </Button>
      {history.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">History</Label>
          <ul className="text-xs space-y-1">
            {history.map((h: any) => (
              <li key={h.id} className="flex items-center gap-2 bg-background rounded px-2 py-1">
                <span className="font-mono text-[10px] text-muted-foreground w-20">{h.effective_date}</span>
                <span>{Number(h.commission_percentage)}% · {h.commission_type}</span>
                {Number(h.fixed_amount_ksh) > 0 && <span className="opacity-70">+KSH {h.fixed_amount_ksh}</span>}
                {h.notes && <span className="opacity-70 truncate">— {h.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


// ---------- NOTIFICATIONS ----------
const TEMPLATE_KEYS = [
  ["founder_welcome", "Founder Welcome"],
  ["weekly_refresh_reminder", "Weekly Refresh Reminder"],
  ["priority_window", "Priority Booking Window"],
  ["birthday", "Birthday Sanctuary"],
  ["gel_rescue", "Gel Rescue"],
  ["no_show_forfeit", "No-Show Forfeit"],
  ["emergency", "Emergency Response"],
  ["installment_reminder", "Installment Reminder"],
  ["term_expiring", "Term Expiring"],
  ["surprise_award", "Surprise Award"],
  ["travel_confirmed", "Travel Confirmed"],
  ["product_prelaunch", "Product Prelaunch"],
];

function NotificationsTab() {
  const { data, save } = useSetting<any>("notifications");
  const [n, setN] = useState<any>({});
  useEffect(() => { if (data) setN(data); }, [data]);
  const tpl = n.templates || {};
  const setTpl = (k: string, v: boolean) => setN({ ...n, templates: { ...tpl, [k]: v } });

  return (
    <div className="space-y-6">
      <Section title="Channels">
        <div className="space-y-2">
          {[
            ["whatsapp_enabled", "WhatsApp automation"],
            ["email_backup", "Email backup notifications"],
            ["in_app", "In-app notifications"],
          ].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border p-3">
              <Label>{l}</Label>
              <Switch checked={!!n[k]} onCheckedChange={(v) => setN({ ...n, [k]: v })} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="WhatsApp Template Toggles" description="Pause specific automated messages without removing them.">
        <div className="grid md:grid-cols-2 gap-2">
          {TEMPLATE_KEYS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm">{label}</span>
              <Switch checked={!!tpl[k]} onCheckedChange={(v) => setTpl(k, v)} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Alert Thresholds">
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Term expiry warning (days)">
            <Input type="number" value={n.term_expiry_warning_days ?? ""} onChange={(e) => setN({ ...n, term_expiry_warning_days: Number(e.target.value) })} />
          </Field>
          <Field label="Low stock threshold">
            <Input type="number" value={n.low_stock_threshold ?? ""} onChange={(e) => setN({ ...n, low_stock_threshold: Number(e.target.value) })} />
          </Field>
          <Field label="No-show streak alert">
            <Input type="number" value={n.no_show_streak_alert ?? ""} onChange={(e) => setN({ ...n, no_show_streak_alert: Number(e.target.value) })} />
          </Field>
        </div>
      </Section>

      <Button onClick={() => save.mutate(n)} size="lg" className="w-full">
        <Save className="h-4 w-4 mr-2" />Save Notification Settings
      </Button>
    </div>
  );
}

// ---------- DATA ----------
function DataTab() {
  const { data, save } = useSetting<any>("data");
  const [d, setD] = useState<any>({});
  useEffect(() => { if (data) setD(data); }, [data]);

  const exportData = async (format: "json" | "csv") => {
    toast.info("Preparing export…");
    const tables = ["clients", "founder_circle", "appointments", "perks_usage", "payments", "products", "founder_purchases"];
    const out: Record<string, any[]> = {};
    for (const t of tables) {
      const { data } = await (supabase as any).from(t).select("*");
      out[t] = data || [];
    }
    if (format === "json") {
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      downloadBlob(blob, `coterie-backup-${new Date().toISOString().slice(0, 10)}.json`);
    } else {
      const lines: string[] = [];
      for (const [t, rows] of Object.entries(out)) {
        lines.push(`### ${t}`);
        if (rows.length) {
          const cols = Object.keys(rows[0]);
          lines.push(cols.join(","));
          for (const r of rows) lines.push(cols.map((c) => JSON.stringify(r[c] ?? "")).join(","));
        }
        lines.push("");
      }
      downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), `coterie-backup-${new Date().toISOString().slice(0, 10)}.csv`);
    }
    toast.success("Export ready");
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const [header, ...rows] = text.trim().split("\n");
    const cols = header.split(",").map((s) => s.trim());
    const records = rows.map((line) => {
      const parts = line.split(",");
      const obj: any = {};
      cols.forEach((c, i) => (obj[c] = (parts[i] || "").trim()));
      return obj;
    });
    const { error } = await supabase.from("clients").insert(records as any);
    if (error) toast.error(error.message);
    else toast.success(`Imported ${records.length} clients`);
  };

  return (
    <div className="space-y-6">
      <Section title="Backup & Retention">
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label>Daily auto-backup</Label>
            <p className="text-xs text-muted-foreground">Snapshots are stored in Cloud storage.</p>
          </div>
          <Switch checked={!!d.auto_backup_enabled} onCheckedChange={(v) => setD({ ...d, auto_backup_enabled: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Backup hour (0–23)">
            <Input type="number" min={0} max={23} value={d.auto_backup_hour ?? ""} onChange={(e) => setD({ ...d, auto_backup_hour: Number(e.target.value) })} />
          </Field>
          <Field label="Auto-archive founders after term (months)">
            <Input type="number" value={d.retention_months_after_term ?? ""} onChange={(e) => setD({ ...d, retention_months_after_term: Number(e.target.value) })} />
          </Field>
        </div>
        <Button onClick={() => save.mutate(d)}><Save className="h-4 w-4 mr-2" />Save</Button>
      </Section>

      <Section title="Export">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => exportData("json")} variant="outline"><Download className="h-4 w-4 mr-2" />Export JSON</Button>
          <Button onClick={() => exportData("csv")} variant="outline"><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button onClick={() => toast.success("Manual backup queued")} variant="outline">
            <RotateCw className="h-4 w-4 mr-2" />Manual Backup Now
          </Button>
        </div>
      </Section>

      <Section title="Import Clients (CSV)" description="Columns: full_name, phone, whatsapp_number, email, address, birthday">
        <label className="block">
          <div className="rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center cursor-pointer hover:bg-accent">
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm">Click to upload CSV</p>
          </div>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])}
          />
        </label>
      </Section>
    </div>
  );
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------- LOCATIONS ----------
function LocationsTab() {
  const qc = useQueryClient();
  const { data: locs = [] } = useQuery({
    queryKey: ["studio_locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("studio_locations").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name) throw new Error("Name required");
      const { error } = await supabase.from("studio_locations").insert(form as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Location added");
      setForm({ name: "", address: "", phone: "" });
      qc.invalidateQueries({ queryKey: ["studio_locations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("studio_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio_locations"] }),
  });

  return (
    <div className="space-y-6">
      <Section title="Studio Locations" description="Future-proof multi-location. Founder Circle perks apply across all locations by default.">
        <div className="space-y-2">
          {(locs as any[]).map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border">
              <MapPin className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <div className="font-medium">
                  {l.name} {l.is_primary && <Badge variant="secondary" className="ml-2">Primary</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">{l.address}</div>
              </div>
              {!l.is_primary && (
                <Button variant="ghost" size="sm" onClick={() => del.mutate(l.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Add Location">
        <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Soin Arcade · Westlands" /></Field>
        <Field label="Address"><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Button onClick={() => add.mutate()}><Plus className="h-4 w-4 mr-2" />Add Location</Button>
      </Section>
    </div>
  );
}

// ---------- INTEGRATIONS ----------
function IntegrationsTab() {
  const { data, save } = useSetting<any>("integrations");
  const [i, setI] = useState<any>({});
  useEffect(() => { if (data) setI(data); }, [data]);

  return (
    <div className="space-y-6">
      <Section title="M-Pesa" description="Safaricom Daraja API for STK Push.">
        <Field label="Environment">
          <Select value={i.mpesa_env || "sandbox"} onValueChange={(v) => setI({ ...i, mpesa_env: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (testing)</SelectItem>
              <SelectItem value="live">Live (production)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Paybill / Shortcode"><Input value={i.mpesa_shortcode || ""} onChange={(e) => setI({ ...i, mpesa_shortcode: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">Consumer key/secret stored securely as Cloud secrets.</p>
      </Section>

      <Section title="WhatsApp Business API">
        <Field label="Phone Number ID"><Input value={i.whatsapp_phone_id || ""} onChange={(e) => setI({ ...i, whatsapp_phone_id: e.target.value })} /></Field>
        <p className="text-xs text-muted-foreground">Meta WABA access token stored as a secure secret.</p>
      </Section>

      <Section title="Cloud Backend">
        <Field label="Project URL">
          <Input value={import.meta.env.VITE_SUPABASE_URL || ""} readOnly className="bg-muted" />
        </Field>
        <p className="text-xs text-muted-foreground">Managed by Lovable Cloud — connection is automatic.</p>
      </Section>

      <Section title="Deployment & Domain">
        <Field label="Custom Domain"><Input value={i.custom_domain || ""} onChange={(e) => setI({ ...i, custom_domain: e.target.value })} placeholder="thecircle.coterie.co.ke" /></Field>
        <p className="text-xs text-muted-foreground">Connect via Project Settings → Domains after publishing.</p>
      </Section>

      <Button onClick={() => save.mutate(i)} size="lg" className="w-full">
        <Save className="h-4 w-4 mr-2" />Save Integrations
      </Button>
    </div>
  );
}

// ---------- ACTIVITY ----------
function ActivityTab() {
  const { data: logs = [] } = useQuery({
    queryKey: ["activity_log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Section title="Activity Log" description="Last 100 audit-tracked actions: surprise awards, gel approvals, appointment edits.">
      <div className="space-y-1.5">
        {(logs as any[]).map((l) => (
          <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg border text-sm">
            <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <div><span className="font-medium">{l.actor || "system"}</span> · {l.action} {l.entity && <span className="text-muted-foreground">on {l.entity}</span>}</div>
              {l.metadata && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{JSON.stringify(l.metadata)}</div>
              )}
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap">
              {new Date(l.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No activity recorded yet.</p>}
      </div>
    </Section>
  );
}
