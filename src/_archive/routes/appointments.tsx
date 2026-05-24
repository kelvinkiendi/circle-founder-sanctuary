import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  MapPin,
  Sparkles,
  Wrench,
  Plane,
  Cake,
  Gift,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Radio,
  Megaphone,
  AlertCircle,
  Bell,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";


const STUDIO_ADDRESS = "Shujaah Mall, opposite Adlife Plaza, Kilimani";
const STUDIO_AREA = "Kilimani";
const FOUNDER_RATE = 0.15;
const TRAVEL_EXTRA = 500;

type ApptType =
  | "weekly_refresh"
  | "gel_rescue"
  | "travel_touchup"
  | "full_manicure"
  | "pedicure"
  | "surprise_full"
  | "random_upgrade"
  | "birthday_sanctuary"
  | "emergency";

type ApptStatus = "booked" | "completed" | "no-show" | "cancelled" | "forfeited";

const TYPE_META: Record<
  ApptType,
  { label: string; chip: string; icon: any; duration: number; special?: boolean }
> = {
  weekly_refresh: {
    label: "Weekly Refresh",
    chip: "bg-[oklch(0.78_0.04_60)] text-[oklch(0.28_0.025_40)]",
    icon: Sparkles,
    duration: 30,
  },
  full_manicure: {
    label: "Full Manicure",
    chip: "bg-primary text-primary-foreground",
    icon: CheckCircle2,
    duration: 75,
  },
  pedicure: {
    label: "Pedicure",
    chip: "bg-primary/85 text-primary-foreground",
    icon: CheckCircle2,
    duration: 75,
  },
  gel_rescue: {
    label: "Gel Rescue",
    chip: "bg-gold text-gold-foreground",
    icon: Wrench,
    duration: 30,
  },
  travel_touchup: {
    label: "Travel Touch-Up",
    chip: "bg-card border border-primary text-primary",
    icon: Plane,
    duration: 10,
  },
  surprise_full: {
    label: "Surprise",
    chip: "bg-gradient-to-r from-gold to-primary text-white animate-pulse",
    icon: Gift,
    duration: 75,
    special: true,
  },
  random_upgrade: {
    label: "Random Upgrade",
    chip: "bg-gradient-to-r from-gold/80 to-secondary text-primary animate-pulse",
    icon: Sparkles,
    duration: 75,
    special: true,
  },
  birthday_sanctuary: {
    label: "Birthday Sanctuary",
    chip: "bg-gradient-to-r from-gold to-secondary text-primary animate-pulse",
    icon: Cake,
    duration: 90,
    special: true,
  },
  emergency: {
    label: "Emergency",
    chip: "bg-destructive text-destructive-foreground animate-pulse",
    icon: AlertCircle,
    duration: 45,
    special: true,
  },
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function AppointmentsPage() {
  const [weekStart, setWeekStart] = useState(startOfWeek());
  const [view, setView] = useState<"day" | "week">("week");
  const [priorityWindow, setPriorityWindow] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newDefaults, setNewDefaults] = useState<{ date?: string; time?: string }>({});
  const [selected, setSelected] = useState<any | null>(null);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const dayCount = view === "week" ? 7 : 1;
  const rangeStart = ymd(weekStart);
  const rangeEnd = ymd(addDays(weekStart, dayCount - 1));

  const { data: appts } = useQuery({
    queryKey: ["appts", rangeStart, rangeEnd],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*, clients(full_name, client_type)")
        .gte("scheduled_date", rangeStart)
        .lte("scheduled_date", rangeEnd)
        .order("scheduled_time");
      return data ?? [];
    },
  });

  const { data: founders } = useQuery({
    queryKey: ["founders-broadcast"],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_circle")
        .select("id, founder_number, clients(full_name, whatsapp_number)")
        .eq("status", "active")
        .order("founder_number");
      return data ?? [];
    },
  });

  return (
    <Layout>
      <PageHeader
        eyebrow="The Sanctuary · Calendar"
        title="Appointments"
        description="Today's rituals, tomorrow's bookings, and every founder perk in between."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEmergencyOpen(true)} className="gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Emergency Line
            </Button>
            <Button onClick={() => { setNewDefaults({}); setNewOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" /> New Appointment
            </Button>
          </div>
        }
      />

      {/* Priority window */}
      <PriorityWindowPanel
        active={priorityWindow}
        onToggle={setPriorityWindow}
        founders={founders ?? []}
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mt-6 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Day</TabsTrigger>
            <TabsTrigger value="week">Week</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -dayCount))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, dayCount))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-sm font-medium">
          {weekStart.toLocaleDateString(undefined, { month: "long", day: "numeric" })} —{" "}
          {addDays(weekStart, dayCount - 1).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      <CalendarGrid
        weekStart={weekStart}
        dayCount={dayCount}
        appts={appts ?? []}
        onSlotClick={(date, time) => {
          setNewDefaults({ date, time });
          setNewOpen(true);
        }}
        onApptClick={(a) => setSelected(a)}
      />

      <Legend />

      <NewAppointmentDialog
        open={newOpen}
        onClose={() => setNewOpen(false)}
        defaults={newDefaults}
      />
      {selected && (
        <AppointmentDetailDialog
          appt={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
      <EmergencyDialog open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </Layout>
  );
}

/* ---------- Priority window ---------- */
function PriorityWindowPanel({
  active,
  onToggle,
  founders,
}: {
  active: boolean;
  onToggle: (v: boolean) => void;
  founders: any[];
}) {
  const [broadcasted, setBroadcasted] = useState<string[]>([]);
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="rounded-md p-2 bg-gold/15 text-gold">
            <Radio className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl">Release to Founders First</h3>
              {active && (
                <Badge className="bg-gold/15 text-gold border-gold/30 hover:bg-gold/20">
                  Active · 48hr early access
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              New time slots become "Founder Exclusive" for 48 hours before public release. First-come, first-served.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={active} onCheckedChange={onToggle} />
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!active}
            onClick={() => {
              const ids = founders.map((f) => f.id);
              setBroadcasted(ids);
              toast.success(`Priority broadcast queued for ${ids.length} founders`, {
                description: "WhatsApp notifications (placeholder)",
              });
            }}
          >
            <Megaphone className="h-4 w-4" /> Broadcast
          </Button>
        </div>
      </div>

      {active && founders.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
            Founders notified ({broadcasted.length}/{founders.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {founders.map((f) => {
              const sent = broadcasted.includes(f.id);
              return (
                <div
                  key={f.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs border ${
                    sent ? "bg-gold/10 border-gold/30 text-gold" : "border-border text-muted-foreground"
                  }`}
                >
                  <Bell className="h-3 w-3" />
                  No.{String(f.founder_number ?? 0).padStart(2, "0")} · {f.clients?.full_name}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Calendar ---------- */
function CalendarGrid({
  weekStart,
  dayCount,
  appts,
  onSlotClick,
  onApptClick,
}: {
  weekStart: Date;
  dayCount: number;
  appts: any[];
  onSlotClick: (date: string, time: string) => void;
  onApptClick: (a: any) => void;
}) {
  const days = Array.from({ length: dayCount }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8am-7pm
  const qc = useQueryClient();

  const reschedule = useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string; time: string }) => {
      const { error } = await supabase
        .from("appointments")
        .update({ scheduled_date: date, scheduled_time: time })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      toast.success("Rescheduled");
    },
    onError: (e: any) => toast.error(e.message ?? "Reschedule failed"),
  });

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div
        className="grid"
        style={{ gridTemplateColumns: `60px repeat(${dayCount}, minmax(0, 1fr))` }}
      >
        {/* Header */}
        <div className="bg-muted/40 border-b border-border" />
        {days.map((d) => {
          const isToday = ymd(d) === ymd(new Date());
          return (
            <div
              key={ymd(d)}
              className={`border-b border-l border-border px-2 py-2 text-center ${
                isToday ? "bg-gold/10" : "bg-muted/30"
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {d.toLocaleDateString(undefined, { weekday: "short" })}
              </div>
              <div className={`font-display text-xl ${isToday ? "text-gold" : ""}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}

        {/* Hour rows */}
        {hours.map((h) => (
          <div key={h} className="contents">
            <div className="text-[10px] text-muted-foreground text-right pr-1 py-2 border-b border-border">
              {h}:00
            </div>
            {days.map((d) => {
              const dateStr = ymd(d);
              const cellAppts = appts.filter(
                (a) =>
                  a.scheduled_date === dateStr &&
                  Number(a.scheduled_time?.slice(0, 2)) === h,
              );
              return (
                <div
                  key={dateStr + h}
                  className="border-b border-l border-border min-h-[64px] relative group"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/appt");
                    if (id) reschedule.mutate({ id, date: dateStr, time: `${String(h).padStart(2, "0")}:00:00` });
                  }}
                >
                  <button
                    className="absolute inset-0 opacity-0 hover:opacity-100 hover:bg-accent/30 transition flex items-center justify-center text-xs text-muted-foreground"
                    onClick={() => onSlotClick(dateStr, `${String(h).padStart(2, "0")}:00`)}
                  >
                    + Book
                  </button>
                  <div className="relative p-1 space-y-1">
                    {cellAppts.map((a) => (
                      <ApptChip key={a.id} appt={a} onClick={() => onApptClick(a)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ApptChip({ appt, onClick }: { appt: any; onClick: () => void }) {
  const meta = TYPE_META[appt.appointment_type as ApptType];
  const Icon = meta?.icon ?? CheckCircle2;
  const dim = appt.status === "cancelled" || appt.status === "no-show" || appt.status === "forfeited";
  return (
    <button
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/appt", appt.id)}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`block w-full text-left text-[11px] rounded-md px-1.5 py-1 truncate ${meta?.chip ?? "bg-secondary"} ${dim ? "opacity-50 line-through" : ""}`}
      title={`${meta?.label} · ${appt.clients?.full_name ?? ""}`}
    >
      <div className="flex items-center gap-1">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium">{appt.clients?.full_name ?? "Guest"}</span>
      </div>
      <div className="text-[9px] opacity-80 truncate">
        {appt.scheduled_time?.slice(0, 5)} · {meta?.label}
      </div>
    </button>
  );
}

function Legend() {
  return (
    <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
      {(Object.keys(TYPE_META) as ApptType[]).map((k) => (
        <span key={k} className={`px-2 py-1 rounded-md ${TYPE_META[k].chip}`}>
          {TYPE_META[k].label}
        </span>
      ))}
    </div>
  );
}

/* ---------- New Appointment ---------- */
function NewAppointmentDialog({
  open,
  onClose,
  defaults,
}: {
  open: boolean;
  onClose: () => void;
  defaults: { date?: string; time?: string };
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [apptType, setApptType] = useState<ApptType>("full_manicure");
  const [date, setDate] = useState(defaults.date ?? ymd(new Date()));
  const [time, setTime] = useState(defaults.time ?? "10:00");
  const [location, setLocation] = useState<"studio" | "travel">("studio");
  const [travelAddress, setTravelAddress] = useState("");
  const [travelArea, setTravelArea] = useState("");
  const [outsideArea, setOutsideArea] = useState(false);
  const [notes, setNotes] = useState("");
  const [redeemingPerk, setRedeemingPerk] = useState(false);
  const [perkId, setPerkId] = useState<string>("");
  const [travelChecks, setTravelChecks] = useState({
    safe: false,
    lit: false,
    power: false,
    chair: false,
    confirmed: false,
  });

  // Reset when defaults change
  useMemo(() => {
    if (defaults.date) setDate(defaults.date);
    if (defaults.time) setTime(defaults.time);
  }, [defaults.date, defaults.time]);

  const { data: clients } = useQuery({
    queryKey: ["client-search-appt", search],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").limit(10);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open,
  });

  const selectedClient = clients?.find((c) => c.id === clientId);
  const isFounder = selectedClient?.client_type === "founder";

  const { data: founder } = useQuery({
    queryKey: ["founder-by-client", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_circle")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId && isFounder,
  });

  const { data: availablePerks } = useQuery({
    queryKey: ["available-perks", founder?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("perks_usage")
        .select("*")
        .eq("founder_id", founder!.id)
        .eq("status", "available");
      return data ?? [];
    },
    enabled: !!founder?.id,
  });

  const { data: lastFullService } = useQuery({
    queryKey: ["last-full", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_date")
        .eq("client_id", clientId)
        .in("appointment_type", ["full_manicure", "surprise_full", "birthday_sanctuary"])
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientId,
  });

  const perkChoices = useMemo(() => {
    if (!availablePerks || !founder) return [];
    return availablePerks.map((p: any) => {
      const eligibility = evaluatePerkEligibility(p, {
        date,
        founder,
        lastFullServiceDate: lastFullService?.scheduled_date,
        clientBirthday: selectedClient?.birthday,
      });
      return { ...p, ...eligibility };
    });
  }, [availablePerks, founder, date, lastFullService, selectedClient]);

  const selectedPerk = perkChoices.find((p) => p.id === perkId);
  const effectiveType: ApptType =
    redeemingPerk && selectedPerk ? (selectedPerk.perk_type as ApptType) : apptType;
  const duration = TYPE_META[effectiveType]?.duration ?? 60;
  const basePrice = redeemingPerk ? 0 : priceFor(effectiveType);
  const extra = location === "travel" && outsideArea ? TRAVEL_EXTRA : 0;
  const founderDiscount = isFounder && !redeemingPerk ? basePrice * FOUNDER_RATE : 0;
  const total = basePrice - founderDiscount + extra;

  const showGelRescue = effectiveType === "gel_rescue";
  const showTravelChecks = location === "travel" || effectiveType === "travel_touchup";

  const create = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Select a client");
      if (redeemingPerk && !selectedPerk?.eligible) {
        throw new Error("Selected perk is not eligible");
      }
      if (showTravelChecks && !Object.values(travelChecks).every(Boolean)) {
        throw new Error("Confirm all workspace requirements");
      }

      const { data: appt, error } = await supabase
        .from("appointments")
        .insert({
          client_id: clientId,
          appointment_type: effectiveType,
          scheduled_date: date,
          scheduled_time: `${time}:00`,
          duration_minutes: duration,
          status: "booked",
          location,
          created_by: "reception:desk",
          notes: [
            notes,
            location === "travel" && `Travel to ${travelAddress} (${travelArea})`,
            outsideArea && `Outside service area · +${TRAVEL_EXTRA} KSH`,
            redeemingPerk && `Perk redemption: ${selectedPerk?.perk_type}`,
            `Total: ${total.toLocaleString()} KSH`,
          ]
            .filter(Boolean)
            .join(" · "),
        })
        .select()
        .single();
      if (error) throw error;

      if (redeemingPerk && selectedPerk) {
        await supabase
          .from("perks_usage")
          .update({
            status: "used",
            used_date: date,
            related_appointment_id: appt.id,
          })
          .eq("id", selectedPerk.id);
      }

      // Queue WhatsApp confirmation (skipped if client opted out)
      if (selectedClient && !selectedClient.whatsapp_opt_out) {
        const firstName = selectedClient.full_name?.split(" ")[0] ?? "there";
        const dateLabel = new Date(date).toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
        });
        const body = `${firstName}, your ${TYPE_META[effectiveType]?.label ?? "appointment"} is confirmed for ${dateLabel} at ${time}. See you at COTERIE Nail Sanctuary, Shujaah Mall, Kilimani. — COTERIE`;
        await supabase.from("whatsapp_messages").insert({
          client_id: clientId,
          template_key: "appointment_confirmation",
          body,
          status: "sent",
          created_by: "appointment_booked",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      qc.invalidateQueries({ queryKey: ["perks"] });
      toast.success("Appointment booked", {
        description: selectedClient?.whatsapp_opt_out
          ? "Client opted out — no WhatsApp sent."
          : "WhatsApp confirmation queued.",
      });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Booking failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="text-[10px] tracking-[0.3em] uppercase text-gold">Booking</div>
          <DialogTitle className="font-display text-3xl">New Appointment</DialogTitle>
          <DialogDescription>Select a client, choose a service, redeem a perk if eligible.</DialogDescription>
        </DialogHeader>

        {/* Client search */}
        <Field label="Client">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search by name…"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="border border-border rounded-md max-h-40 overflow-y-auto divide-y divide-border mt-2">
            {clients?.map((c) => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between ${clientId === c.id ? "bg-accent" : ""}`}
              >
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone ?? "no phone"}</div>
                </div>
                {c.client_type === "founder" && (
                  <Badge className="bg-gold/15 text-gold border-gold/30">Founder</Badge>
                )}
              </button>
            ))}
          </div>
        </Field>

        {/* Founder perk */}
        {isFounder && (
          <div className="bg-gold/5 border border-gold/30 rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" />
                <span className="text-sm font-medium">Redeem Founder Perk</span>
              </div>
              <Switch checked={redeemingPerk} onCheckedChange={setRedeemingPerk} />
            </div>
            {redeemingPerk && (
              <>
                <Select value={perkId} onValueChange={setPerkId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an available perk…" />
                  </SelectTrigger>
                  <SelectContent>
                    {perkChoices.map((p) => (
                      <SelectItem key={p.id} value={p.id} disabled={!p.eligible}>
                        {TYPE_META[p.perk_type as ApptType]?.label ?? p.perk_type}
                        {!p.eligible && " — ineligible"}
                      </SelectItem>
                    ))}
                    {!perkChoices.length && (
                      <div className="px-2 py-3 text-xs text-muted-foreground italic">
                        No available perks
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {selectedPerk && (
                  <div
                    className={`text-xs rounded-md p-2 ${
                      selectedPerk.eligible
                        ? "bg-card border border-border text-muted-foreground"
                        : "bg-destructive/10 text-destructive border border-destructive/30"
                    }`}
                  >
                    {selectedPerk.eligible ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedPerk.reason}
                      </div>
                    ) : (
                      <div className="flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5" />
                        <span>{selectedPerk.reason}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {!redeemingPerk && (
            <Field label="Service Type">
              <Select value={apptType} onValueChange={(v) => setApptType(v as ApptType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as ApptType[])
                    .filter((t) => t !== "emergency")
                    .map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Time (15-min increments)">
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {timeSlots().map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Duration">
            <Input value={`${duration} min`} readOnly />
          </Field>
        </div>

        {/* Location */}
        <Field label="Location">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLocation("studio")}
              className={`flex-1 border rounded-md p-3 text-left text-sm ${location === "studio" ? "border-gold bg-gold/5" : "border-border"}`}
            >
              <div className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Studio
              </div>
              <div className="text-xs text-muted-foreground mt-1">{STUDIO_ADDRESS}</div>
            </button>
            <button
              type="button"
              onClick={() => setLocation("travel")}
              className={`flex-1 border rounded-md p-3 text-left text-sm ${location === "travel" ? "border-gold bg-gold/5" : "border-border"}`}
            >
              <div className="font-medium flex items-center gap-2">
                <Plane className="h-4 w-4" /> Travel
              </div>
              <div className="text-xs text-muted-foreground mt-1">Client's location</div>
            </button>
          </div>
        </Field>

        {location === "travel" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Address">
              <Input value={travelAddress} onChange={(e) => setTravelAddress(e.target.value)} />
            </Field>
            <Field label="Service Area">
              <Input
                value={travelArea}
                onChange={(e) => setTravelArea(e.target.value)}
                placeholder={STUDIO_AREA}
              />
            </Field>
            <div className="col-span-2 flex items-center justify-between bg-card border border-border rounded-md p-3 text-sm">
              <div>
                <div className="font-medium">Outside service area ({STUDIO_AREA})</div>
                <div className="text-xs text-muted-foreground">Adds {TRAVEL_EXTRA.toLocaleString()} KSH transport</div>
              </div>
              <Switch checked={outsideArea} onCheckedChange={setOutsideArea} />
            </div>
          </div>
        )}

        {showTravelChecks && (
          <div className="bg-card border border-border rounded-md p-3 space-y-2">
            <div className="text-[10px] tracking-[0.25em] uppercase text-gold">Workspace Requirements</div>
            <CheckRow label="Safe environment" checked={travelChecks.safe} onChange={(v) => setTravelChecks({ ...travelChecks, safe: v })} />
            <CheckRow label="Well-lit area" checked={travelChecks.lit} onChange={(v) => setTravelChecks({ ...travelChecks, lit: v })} />
            <CheckRow label="Power outlet available" checked={travelChecks.power} onChange={(v) => setTravelChecks({ ...travelChecks, power: v })} />
            <CheckRow label="Suitable chair" checked={travelChecks.chair} onChange={(v) => setTravelChecks({ ...travelChecks, chair: v })} />
            <CheckRow label="Client confirmed all of the above" checked={travelChecks.confirmed} onChange={(v) => setTravelChecks({ ...travelChecks, confirmed: v })} />
            {effectiveType === "travel_touchup" && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 pt-1 border-t border-border">
                <Clock className="h-3 w-3" /> 10-minute touch-up · upgrade required if longer
              </div>
            )}
          </div>
        )}

        {showGelRescue && (
          <GelRescuePanel lastFullDate={lastFullService?.scheduled_date} />
        )}

        <Field label="Notes">
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {/* Pricing summary */}
        <div className="bg-secondary/50 border border-border rounded-md p-3 text-sm space-y-1">
          <Row label="Base" value={`${basePrice.toLocaleString()} KSH`} />
          {founderDiscount > 0 && (
            <Row label="Founder Rate (15%)" value={`− ${founderDiscount.toLocaleString()} KSH`} accent />
          )}
          {extra > 0 && <Row label="Travel surcharge" value={`+ ${extra.toLocaleString()} KSH`} />}
          {redeemingPerk && <Row label="Perk redemption" value="FREE" accent />}
          <div className="border-t border-border pt-1 mt-1 flex justify-between font-display text-lg">
            <span>Total</span>
            <span>{total.toLocaleString()} KSH</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Booking…" : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GelRescuePanel({ lastFullDate }: { lastFullDate?: string }) {
  const [cause, setCause] = useState<"defect" | "negligence">("defect");
  const [approved, setApproved] = useState(true);
  const within7 = lastFullDate
    ? (Date.now() - new Date(lastFullDate).getTime()) / 86400000 <= 7
    : false;
  const hoursLeft = lastFullDate
    ? Math.max(0, 48 - (Date.now() - new Date(lastFullDate).getTime()) / 3600000)
    : 0;

  return (
    <div className="bg-card border border-border rounded-md p-3 space-y-3">
      <div className="text-[10px] tracking-[0.25em] uppercase text-gold">Gel Rescue Workflow</div>
      <div className="text-xs">
        <div>Last full service: <strong>{lastFullDate ?? "—"}</strong></div>
        <div className={within7 ? "text-green-700 dark:text-green-400" : "text-destructive"}>
          {within7 ? "✓ Within 7-day rescue window" : "✗ Outside 7-day rescue window"}
        </div>
        {lastFullDate && (
          <div className="text-muted-foreground">
            Reporting deadline: {hoursLeft.toFixed(1)}hrs remaining of 48hr window
          </div>
        )}
      </div>
      <div className="border-2 border-dashed border-border rounded-md p-4 text-center text-xs text-muted-foreground">
        Damage photo upload (placeholder)
      </div>
      <Field label="Cause Assessment">
        <Select value={cause} onValueChange={(v) => setCause(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="defect">Service Defect (covered)</SelectItem>
            <SelectItem value="negligence">Client Negligence — nails as tools / harsh chemicals</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="flex items-center justify-between bg-secondary/40 rounded-md p-2">
        <div className="text-sm">
          {approved ? "Eligible for Gel Rescue (free)" : "Requires Full Re-service at Founder Rate"}
        </div>
        <Switch checked={approved} onCheckedChange={setApproved} />
      </div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(!!v)} />
      <span>{label}</span>
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${accent ? "text-gold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

/* ---------- Appointment Detail / Status ---------- */
function AppointmentDetailDialog({
  appt,
  open,
  onClose,
}: {
  appt: any;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const meta = TYPE_META[appt.appointment_type as ApptType];

  const update = useMutation({
    mutationFn: async (next: ApptStatus) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: next })
        .eq("id", appt.id);
      if (error) throw error;

      // Side effects on perk records
      if (next === "no-show") {
        await supabase
          .from("perks_usage")
          .update({ status: "forfeited" })
          .eq("related_appointment_id", appt.id);
      } else if (next === "cancelled") {
        await supabase
          .from("perks_usage")
          .update({ status: "available", used_date: null, related_appointment_id: null })
          .eq("related_appointment_id", appt.id);
      }

      // WhatsApp on cancel (skip if client opted out)
      if (next === "cancelled" && appt.client_id) {
        const { data: c } = await supabase
          .from("clients")
          .select("full_name, whatsapp_opt_out")
          .eq("id", appt.client_id)
          .maybeSingle();
        if (c && !c.whatsapp_opt_out) {
          const firstName = c.full_name?.split(" ")[0] ?? "there";
          const dateLabel = new Date(appt.scheduled_date).toLocaleDateString("en-GB", {
            weekday: "long", day: "numeric", month: "long",
          });
          const body = `${firstName}, your ${meta?.label ?? "appointment"} on ${dateLabel} at ${appt.scheduled_time?.slice(0,5)} has been cancelled. Reply to rebook. — COTERIE`;
          await supabase.from("whatsapp_messages").insert({
            client_id: appt.client_id,
            template_key: "appointment_cancellation",
            body,
            status: "sent",
            created_by: "appointment_cancelled",
          });
        }
      }
    },
    onSuccess: (_d, next) => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      qc.invalidateQueries({ queryKey: ["perks"] });
      const messages: Record<ApptStatus, string> = {
        completed: "Marked complete",
        "no-show": "No-show recorded · perk forfeited",
        cancelled: "Cancelled · perk returned · WhatsApp queued",
        booked: "Status updated",
        forfeited: "Forfeited",
      };
      toast.success(messages[next] ?? "Updated");
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const apptDate = new Date(`${appt.scheduled_date}T${appt.scheduled_time}`);
  const hoursToAppt = (apptDate.getTime() - Date.now()) / 3600000;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-xs ${meta?.chip}`}>
              {meta?.label}
            </span>
            <Badge variant="outline" className="uppercase text-[10px]">{appt.status}</Badge>
          </div>
          <DialogTitle className="font-display text-2xl">
            {appt.clients?.full_name ?? "Guest"}
          </DialogTitle>
          <DialogDescription>
            {new Date(appt.scheduled_date).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}{" "}
            · {appt.scheduled_time?.slice(0, 5)} · {appt.duration_minutes} min
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row label="Location" value={appt.location} />
          {appt.notes && (
            <div className="text-sm bg-card border border-border rounded-md p-3">
              {appt.notes}
            </div>
          )}

          {appt.appointment_type === "weekly_refresh" && (
            <div className="bg-secondary/40 border border-border rounded-md p-3 text-xs">
              <div className="font-medium">Weekly Refresh rules</div>
              <ul className="list-disc pl-4 space-y-0.5 mt-1 text-muted-foreground">
                <li>24hr no-show = automatic forfeit</li>
                <li>12hr notice = 1 reschedule allowed per week</li>
                <li>No carryover into next week</li>
              </ul>
            </div>
          )}

          {hoursToAppt < 24 && hoursToAppt > 0 && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Less than 24hr away — cancellation will forfeit perk
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button variant="outline" onClick={() => update.mutate("booked")} className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Check-in
          </Button>
          <Button onClick={() => update.mutate("completed")} className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Complete
          </Button>
          <Button variant="outline" onClick={() => update.mutate("cancelled")} className="gap-1">
            <XCircle className="h-3 w-3" /> Cancel
          </Button>
          <Button variant="destructive" onClick={() => update.mutate("no-show")} className="gap-1">
            <AlertTriangle className="h-3 w-3" /> No-Show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Emergency Dialog ---------- */
function EmergencyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [reasons, setReasons] = useState<Record<string, boolean>>({});
  const [resolution, setResolution] = useState<"remote" | "in_person">("in_person");
  const [time, setTime] = useState(
    new Date(Date.now() + 60 * 60 * 1000).toTimeString().slice(0, 5),
  );

  const { data: clients } = useQuery({
    queryKey: ["client-search-emerg", search],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, phone").limit(8);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open,
  });

  const checklist = [
    "Wedding within 24hrs",
    "Interview within 24hrs",
    "Flight within 24hrs",
    "Photoshoot within 24hrs",
    "Allergic reaction",
    "Injury",
    "Suspected infection",
  ];
  const anyChecked = Object.values(reasons).some(Boolean);
  const isAfterHours = new Date().getHours() >= 19;

  const create = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Select a client");
      if (!anyChecked) throw new Error("Validate at least one emergency reason");
      const reasonText = Object.keys(reasons).filter((k) => reasons[k]).join(", ");
      const { error } = await supabase.from("appointments").insert({
        client_id: clientId,
        appointment_type: "emergency",
        scheduled_date: ymd(new Date()),
        scheduled_time: `${time}:00`,
        duration_minutes: TYPE_META.emergency.duration,
        status: "booked",
        location: resolution === "remote" ? "studio" : "studio",
        notes: `EMERGENCY · ${reasonText} · resolution: ${resolution}${isAfterHours ? " · after-hours" : ""}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appts"] });
      toast.success("Emergency booked · target response 2hrs");
      onClose();
      setReasons({});
      setClientId("");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-destructive">Emergency Line</div>
          </div>
          <DialogTitle className="font-display text-3xl">Urgent Appointment</DialogTitle>
          <DialogDescription>
            Target response time: 2 hours. {isAfterHours && <span className="text-destructive font-medium">After-hours request (past 7 PM)</span>}
          </DialogDescription>
        </DialogHeader>

        <Field label="Client">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="border border-border rounded-md max-h-32 overflow-y-auto divide-y divide-border mt-2">
            {clients?.map((c) => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${clientId === c.id ? "bg-accent" : ""}`}
              >
                <div className="font-medium">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">{c.phone}</div>
              </button>
            ))}
          </div>
        </Field>

        <div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-2">
            Emergency Validation Checklist
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-card border border-border rounded-md p-3">
            {checklist.map((r) => (
              <CheckRow
                key={r}
                label={r}
                checked={!!reasons[r]}
                onChange={(v) => setReasons({ ...reasons, [r]: v })}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Resolution Type">
            <Select value={resolution} onValueChange={(v) => setResolution(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="remote">Remote (video call)</SelectItem>
                <SelectItem value="in_person">In-person</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target Time">
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <div className="bg-destructive/5 border border-destructive/30 rounded-md p-3 text-xs flex items-start gap-2">
          <Clock className="h-4 w-4 text-destructive mt-0.5" />
          <div>
            <div className="font-medium text-destructive">Response window: 2 hours from booking</div>
            <div className="text-muted-foreground mt-1">
              Confirmation will be sent immediately via WhatsApp (placeholder).
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Dispatching…" : "Book Emergency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- helpers ---------- */
function timeSlots() {
  const out: string[] = [];
  for (let h = 8; h <= 19; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

function priceFor(t: ApptType) {
  const map: Partial<Record<ApptType, number>> = {
    weekly_refresh: 2500,
    full_manicure: 5000,
    pedicure: 4500,
    gel_rescue: 1500,
    travel_touchup: 1500,
    surprise_full: 5000,
    random_upgrade: 5000,
    birthday_sanctuary: 6000,
    emergency: 7500,
  };
  return map[t] ?? 0;
}

function startOfWeekISO(d = new Date()) {
  const x = startOfWeek(d);
  return ymd(x);
}

function evaluatePerkEligibility(
  perk: any,
  ctx: {
    date: string;
    founder: any;
    lastFullServiceDate?: string;
    clientBirthday?: string | null;
  },
): { eligible: boolean; reason: string } {
  const today = new Date();
  const apptDate = new Date(ctx.date);
  const termEnd = ctx.founder.term_end_date ? new Date(ctx.founder.term_end_date) : null;
  const inTerm = termEnd ? apptDate <= termEnd : false;

  if (!inTerm) return { eligible: false, reason: "Outside founder term." };

  switch (perk.perk_type) {
    case "weekly_refresh": {
      // available + not used this week + not forfeited (status already 'available' filter)
      const weekStart = startOfWeekISO(apptDate);
      // approximation: if a perk's used_date is this week, ineligible — but we filtered to available
      return {
        eligible: true,
        reason: `Available · book same-day or 24hr advance · week of ${weekStart}`,
      };
    }
    case "gel_rescue": {
      if (!ctx.lastFullServiceDate) {
        return { eligible: false, reason: "No prior full service on record." };
      }
      const days = (Date.now() - new Date(ctx.lastFullServiceDate).getTime()) / 86400000;
      if (days > 7) return { eligible: false, reason: `Last full service ${days.toFixed(0)} days ago — outside 7-day window.` };
      return { eligible: true, reason: `Within 7 days of last full service (${days.toFixed(0)}d ago).` };
    }
    case "travel_touchup": {
      const hoursAway = (apptDate.getTime() - today.getTime()) / 3600000;
      if (hoursAway < 48)
        return { eligible: false, reason: `Requires 48hr advance booking (${hoursAway.toFixed(0)}hr away).` };
      return { eligible: true, reason: "Monthly quota available · 48hr advance met." };
    }
    case "birthday_sanctuary": {
      if (!ctx.clientBirthday) return { eligible: false, reason: "No birthday on file." };
      const b = new Date(ctx.clientBirthday);
      const thisYearB = new Date(today.getFullYear(), b.getMonth(), b.getDate());
      const diff = Math.abs((apptDate.getTime() - thisYearB.getTime()) / 86400000);
      if (diff > 3) return { eligible: false, reason: "Outside birthday week (3 days before/after)." };
      const advance = (apptDate.getTime() - today.getTime()) / 86400000;
      if (advance < 7) return { eligible: false, reason: `Must book 7 days in advance (${advance.toFixed(1)}d).` };
      return { eligible: true, reason: "Within birthday week · 7-day advance met." };
    }
    default:
      return { eligible: true, reason: "Available." };
  }
}
