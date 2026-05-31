import { useEffect, useMemo, useRef, useState } from "react";
import { useSession as useSessionCtx, RequireRole as RequireRoleCtx } from "@/lib/session";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Lock,
  LogOut,
  MapPin,
  Star,
  Sparkles,
  Camera,
  Timer,
  CheckCircle2,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertTriangle,
  Gift,
  Plane,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";


// ---------- Types ----------
type Appt = {
  id: string;
  client_id: string;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  appointment_type: string;
  status: string;
  location: string;
  notes: string | null;
};

// ---------- PIN gate ----------
const VALID_PINS: Record<string, string> = {
  "1234": "Amani",
  "2580": "Nia",
  "0000": "COTERIE Demo",
};

function usePinSession() {
  const [tech, setTech] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("coterie_tech_name");
  });
  const login = (pin: string) => {
    const name = VALID_PINS[pin];
    if (!name) return false;
    localStorage.setItem("coterie_tech_name", name);
    setTech(name);
    return true;
  };
  const logout = () => {
    localStorage.removeItem("coterie_tech_name");
    setTech(null);
  };
  return { tech, login, logout };
}

function PinScreen({ onLogin }: { onLogin: (pin: string) => boolean }) {
  const [pin, setPin] = useState("");
  const press = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (!onLogin(next)) {
          toast.error("Invalid PIN");
          setPin("");
        }
      }, 100);
    }
  };
  const back = () => setPin((p) => p.slice(0, -1));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="font-display text-3xl tracking-[0.3em] text-primary mb-1">COTERIE</div>
      <div className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground mb-10">
        Technician Access
      </div>
      <div className="flex gap-3 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              pin.length > i ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => (
          <button
            key={n}
            onClick={() => press(n)}
            className="aspect-square rounded-full bg-card border text-2xl font-light active:scale-95 active:bg-accent transition-transform"
          >
            {n}
          </button>
        ))}
        <div />
        <button
          onClick={() => press("0")}
          className="aspect-square rounded-full bg-card border text-2xl font-light active:scale-95 active:bg-accent transition-transform"
        >
          0
        </button>
        <button
          onClick={back}
          className="aspect-square rounded-full flex items-center justify-center text-muted-foreground active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-8">Demo PINs: 1234 · 2580 · 0000</p>
    </div>
  );
}

// ---------- Online status ----------
function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

// ---------- Type styling ----------
function apptStyle(type: string) {
  switch (type) {
    case "weekly_refresh":
      return { label: "Weekly Refresh", bg: "bg-[#d4b896]/30 border-[#a67c52]", chip: "bg-[#a67c52] text-white" };
    case "full_service":
    case "full_manicure":
      return { label: "Full Manicure", bg: "bg-[#5c3a21]/15 border-[#5c3a21]", chip: "bg-[#5c3a21] text-white" };
    case "gel_rescue":
      return { label: "Gel Rescue", bg: "bg-amber-100 border-amber-500", chip: "bg-amber-500 text-white" };
    case "travel_touchup":
    case "travel":
      return { label: "Travel Touch-Up", bg: "bg-[#f5ecd9] border-[#8b6f47]", chip: "bg-[#8b6f47] text-white" };
    case "birthday":
    case "surprise":
    case "emergency":
      return { label: "Surprise", bg: "bg-gradient-to-br from-amber-50 to-rose-50 border-amber-400", chip: "bg-amber-400 text-amber-950" };
    default:
      return { label: type, bg: "bg-card border-border", chip: "bg-muted text-foreground" };
  }
}

// ---------- Swipe card ----------
function SwipeCard({
  appt,
  client,
  onCheckIn,
  onComplete,
  onOpen,
}: {
  appt: Appt;
  client: any;
  onCheckIn: () => void;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const moved = useRef(false);

  const style = apptStyle(appt.appointment_type);
  const isSurprise = ["birthday", "surprise", "emergency"].includes(appt.appointment_type);
  const isTravel = appt.appointment_type === "travel_touchup" || appt.appointment_type === "travel";

  const onStart = (x: number) => {
    startX.current = x;
    moved.current = false;
  };
  const onMove = (x: number) => {
    if (startX.current == null) return;
    const d = x - startX.current;
    if (Math.abs(d) > 5) moved.current = true;
    setDx(Math.max(-160, Math.min(160, d)));
  };
  const onEnd = () => {
    if (dx > 100) onCheckIn();
    else if (dx < -100) onComplete();
    setDx(0);
    startX.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-0 flex items-center justify-between px-6 text-sm font-medium">
        <span className="text-emerald-600 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> Check In
        </span>
        <span className="text-primary flex items-center gap-2">
          Complete <CheckCircle2 className="h-5 w-5" />
        </span>
      </div>
      <div
        className={`relative border-2 rounded-xl p-4 ${style.bg} transition-transform touch-pan-y`}
        style={{ transform: `translateX(${dx}px)` }}
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchMove={(e) => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseMove={(e) => e.buttons === 1 && onMove(e.clientX)}
        onMouseUp={onEnd}
        onClick={() => !moved.current && onOpen()}
      >
        {isSurprise && (
          <div className="flex items-center justify-center gap-2 -mt-1 mb-2 py-1 rounded bg-amber-400 text-amber-950 text-xs font-bold tracking-widest animate-pulse">
            <Star className="h-3 w-3" /> DO NOT CHARGE <Star className="h-3 w-3" />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-foreground/70">
              {appt.scheduled_time?.slice(0, 5)} · {appt.duration_minutes}min
            </div>
            <div className="text-lg font-semibold truncate">
              {client?.full_name || "Client"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.chip} uppercase tracking-wider`}>
                {style.label}
              </span>
              {appt.status === "checked_in" && (
                <Badge variant="secondary" className="text-[10px]">Checked In</Badge>
              )}
              {appt.status === "completed" && (
                <Badge className="text-[10px] bg-emerald-600">Done</Badge>
              )}
            </div>
            {isTravel && client?.address && (
              <div className="flex items-center gap-1 mt-2 text-xs text-foreground/70">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{client.address}</span>
              </div>
            )}
          </div>
          <ChevronRight className="h-5 w-5 text-foreground/40 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ---------- Main view ----------
export function TechView() {
  const { session, logout } = useSessionCtx();
  if (!session) {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }
  return (
    <RequireRoleCtx roles={["technician","admin"]}>
      <Schedule tech={session.fullName} onLogout={logout} />
    </RequireRoleCtx>
  );
}

function Schedule({ tech, onLogout }: { tech: string; onLogout: () => void }) {
  const qc = useQueryClient();
  const online = useOnline();
  const today = new Date().toISOString().slice(0, 10);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rescueId, setRescueId] = useState<string | null>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [travelId, setTravelId] = useState<string | null>(null);

  const { data: appts = [] } = useQuery({
    queryKey: ["tech-appts", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("scheduled_date", today)
        .order("scheduled_time");
      if (error) throw error;
      localStorage.setItem(`coterie_sched_${today}`, JSON.stringify(data));
      return data as Appt[];
    },
    initialData: () => {
      if (typeof window === "undefined") return undefined;
      const cached = localStorage.getItem(`coterie_sched_${today}`);
      return cached ? (JSON.parse(cached) as Appt[]) : undefined;
    },
  });

  const clientIds = useMemo(() => [...new Set(appts.map((a) => a.client_id))], [appts]);
  const { data: clients = [] } = useQuery({
    queryKey: ["tech-clients", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone, whatsapp_number, address, notes, client_type")
        .in("id", clientIds);
      if (error) throw error;
      return data;
    },
  });
  const clientMap = useMemo(
    () => Object.fromEntries((clients as any[]).map((c) => [c.id, c])),
    [clients]
  );

  const { data: founders = [] } = useQuery({
    queryKey: ["tech-founders", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_circle")
        .select("client_id, founder_number, status")
        .in("client_id", clientIds);
      if (error) throw error;
      return data;
    },
  });
  const founderMap = useMemo(
    () => Object.fromEntries((founders as any[]).map((f) => [f.client_id, f])),
    [founders]
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      // queue offline
      if (!navigator.onLine) {
        const q = JSON.parse(localStorage.getItem("coterie_offline_queue") || "[]");
        q.push({ id, status, at: Date.now() });
        localStorage.setItem("coterie_offline_queue", JSON.stringify(q));
        return { offline: true };
      }
      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
      return { offline: false };
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["tech-appts"] });
      toast.success(
        `${vars.status === "checked_in" ? "Checked in" : "Completed"}${res.offline ? " (offline · will sync)" : ""}`
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Auto-sync offline queue
  useEffect(() => {
    if (!online) return;
    const q = JSON.parse(localStorage.getItem("coterie_offline_queue") || "[]");
    if (!q.length) return;
    (async () => {
      for (const item of q) {
        await supabase.from("appointments").update({ status: item.status as any }).eq("id", item.id);
      }
      localStorage.removeItem("coterie_offline_queue");
      toast.success(`Synced ${q.length} offline update${q.length > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["tech-appts"] });
    })();
  }, [online, qc]);

  const activeAppt = appts.find((a) => a.id === openId) || null;
  const rescueAppt = appts.find((a) => a.id === rescueId) || null;
  const completeAppt = appts.find((a) => a.id === completeId) || null;
  const travelAppt = appts.find((a) => a.id === travelId) || null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
            Today · {new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
          </div>
          <div className="text-lg font-display tracking-wider">Hello, {tech}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 text-[10px] uppercase tracking-wider ${online ? "text-emerald-600" : "text-amber-600"}`}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </span>
          <button onClick={onLogout} className="text-muted-foreground active:opacity-60">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {appts.length === 0 && (
          <div className="text-center py-16 text-muted-foreground text-sm">
            No appointments scheduled today.
          </div>
        )}
        {appts.map((a) => (
          <SwipeCard
            key={a.id}
            appt={a}
            client={{
              ...clientMap[a.client_id],
              founder_number: founderMap[a.client_id]?.founder_number,
            }}
            onCheckIn={() => updateStatus.mutate({ id: a.id, status: "checked_in" })}
            onComplete={() => setCompleteId(a.id)}
            onOpen={() => setOpenId(a.id)}
          />
        ))}
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-6 tracking-widest">
        SWIPE RIGHT TO CHECK IN · SWIPE LEFT TO COMPLETE
      </p>

      {/* Client quick card */}
      <ClientQuickCard
        open={!!activeAppt}
        appt={activeAppt}
        client={activeAppt ? clientMap[activeAppt.client_id] : null}
        founder={activeAppt ? founderMap[activeAppt.client_id] : null}
        onClose={() => setOpenId(null)}
        onGelRescue={() => {
          setRescueId(openId);
          setOpenId(null);
        }}
        onTravel={() => {
          setTravelId(openId);
          setOpenId(null);
        }}
        onComplete={() => {
          setCompleteId(openId);
          setOpenId(null);
        }}
      />

      <GelRescueDialog
        open={!!rescueAppt}
        appt={rescueAppt}
        onClose={() => setRescueId(null)}
      />

      <CompleteDialog
        open={!!completeAppt}
        appt={completeAppt}
        onClose={() => setCompleteId(null)}
        onDone={() => {
          updateStatus.mutate({ id: completeAppt!.id, status: "completed" });
          setCompleteId(null);
        }}
      />

      <TravelDialog
        open={!!travelAppt}
        appt={travelAppt}
        client={travelAppt ? clientMap[travelAppt.client_id] : null}
        onClose={() => setTravelId(null)}
      />
    </div>
  );
}

// ---------- Client quick card ----------
function ClientQuickCard({
  open,
  appt,
  client,
  founder,
  onClose,
  onGelRescue,
  onTravel,
  onComplete,
}: any) {
  if (!appt) return null;
  const style = apptStyle(appt.appointment_type);
  const isSurprise = ["birthday", "surprise", "emergency"].includes(appt.appointment_type);
  const isGel = appt.appointment_type === "gel_rescue";
  const isTravel = appt.appointment_type === "travel_touchup" || appt.appointment_type === "travel";
  const isFounder = !!founder?.founder_number;
  const isPerk =
    ["weekly_refresh", "travel_touchup", "travel", "birthday"].includes(appt.appointment_type) ||
    isSurprise;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className={`p-5 ${style.bg} border-b`}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-display">
              {client?.full_name || "Client"}
            </DialogTitle>
            {isFounder && (
              <div className="text-xs tracking-widest uppercase text-foreground/70">
                Founder #{founder.founder_number}
              </div>
            )}
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4">
          {isPerk && (
            <div className="rounded-lg bg-emerald-50 border-2 border-emerald-500 p-3 text-center">
              <div className="text-xs uppercase tracking-widest text-emerald-700">Perk Redemption</div>
              <div className="text-2xl font-bold text-emerald-700">FREE SERVICE</div>
              <div className="text-xs text-emerald-700/80">Do not collect payment</div>
            </div>
          )}

          {isSurprise && (
            <div className="rounded-lg bg-amber-100 border-2 border-amber-500 p-3 text-center animate-pulse">
              <div className="text-xs uppercase tracking-widest text-amber-900">
                ⚠ Do not mention surprise upgrade
              </div>
            </div>
          )}

          {isFounder && !isPerk && (
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 text-center">
              <div className="text-sm font-semibold text-primary">15% OFF — Founder Rate</div>
              <div className="text-xs text-muted-foreground">Do not charge full price</div>
            </div>
          )}

          <div className="flex justify-between text-sm">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Service</div>
              <div className="font-medium">{style.label}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Duration</div>
              <div className="font-medium">{appt.duration_minutes} min</div>
            </div>
          </div>

          {client?.notes && (
            <div className="rounded-lg bg-muted p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
                Notes & Preferences
              </div>
              <div className="text-sm whitespace-pre-wrap">{client.notes}</div>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="text-[10px] uppercase tracking-widest text-amber-800 mb-1">
              Suggest Add-Ons
            </div>
            <div className="text-sm">Cuticle oil · Magnetic clasp · Hand cream</div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            {isGel && (
              <Button variant="outline" onClick={onGelRescue} className="col-span-2">
                <Camera className="h-4 w-4 mr-2" /> Assess Damage
              </Button>
            )}
            {isTravel && (
              <Button variant="outline" onClick={onTravel} className="col-span-2">
                <Plane className="h-4 w-4 mr-2" /> Travel Checklist
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button onClick={onComplete}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> Complete
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Gel rescue workflow ----------
function GelRescueDialog({ open, appt, onClose }: any) {
  const [negligence, setNegligence] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const submit = async () => {
    if (!appt) return;
    await supabase.from("notifications").insert({
      kind: "gel_rescue_approval",
      message: `Gel rescue assessment for appt ${appt.id}: ${
        negligence ? "Client Negligence — suggest Full Re-service at Founder Rate" : "Service Defect — eligible for free rescue"
      }. Notes: ${notes || "—"}`,
    });
    toast.success("Sent to COTERIE for approval");
    onClose();
    setNegligence(false);
    setPhoto(null);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" /> Gel Rescue Assessment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <button
            onClick={() => setPhoto("photo-placeholder")}
            className="w-full aspect-video rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground active:bg-accent"
          >
            <Camera className="h-8 w-8 mb-2" />
            <span className="text-sm">{photo ? "Photo captured ✓" : "Take damage photo"}</span>
          </button>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Cause assessment</Label>
              <div className="text-xs text-muted-foreground">
                {negligence ? "Client Negligence (nails as tools, chemicals)" : "Service Defect"}
              </div>
            </div>
            <Switch checked={negligence} onCheckedChange={setNegligence} />
          </div>

          {negligence && (
            <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900">
                Suggest <strong>Full Re-service at Founder Rate</strong> — not eligible for free rescue.
              </div>
            </div>
          )}

          <Textarea
            placeholder="Notes for COTERIE approval…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit}>Request Approval</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Service completion ----------
const INVENTORY = ["Base coat", "Top coat", "Gel polish", "Cuticle oil", "Acetone", "Buffer"];

function CompleteDialog({ open, appt, onClose, onDone }: any) {
  const [elapsed, setElapsed] = useState(0);
  const [products, setProducts] = useState<string[]>([]);
  const [tips, setTips] = useState("");

  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!appt) return null;
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const over = min > appt.duration_minutes;

  const toggle = (p: string) =>
    setProducts((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Timer className="h-5 w-5" /> Complete Service
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className={`rounded-lg p-4 text-center ${over ? "bg-amber-50 border border-amber-300" : "bg-muted"}`}>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Actual · scheduled {appt.duration_minutes}min
            </div>
            <div className={`text-3xl font-mono ${over ? "text-amber-700" : ""}`}>
              {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Products used
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {INVENTORY.map((p) => (
                <button
                  key={p}
                  onClick={() => toggle(p)}
                  className={`px-3 py-1.5 rounded-full text-xs border ${
                    products.includes(p)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Notes for next visit
            </Label>
            <Textarea
              value={tips}
              onChange={(e) => setTips(e.target.value)}
              rows={3}
              placeholder="Nail shape, preferred color, special requests…"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={onDone} className="w-full sm:w-auto">
            <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Travel checklist ----------
const TRAVEL_ITEMS = [
  "Portable lamp",
  "Sanitized tools",
  "Polish kit",
  "Towel & mat",
  "Hand sanitizer",
  "Payment device",
];

function TravelDialog({ open, appt, client, onClose }: any) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [paid, setPaid] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!appt) return null;
  const min = Math.floor(elapsed / 60);
  const warn = min >= 8 && min < 10;
  const over = min >= 10;

  const gpsUrl = client?.address
    ? `https://maps.google.com/?q=${encodeURIComponent(client.address)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Plane className="h-5 w-5" /> Travel Touch-Up
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {gpsUrl && (
            <a
              href={gpsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border p-3 active:bg-accent"
            >
              <MapPin className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="text-xs text-muted-foreground">GPS directions</div>
                <div className="text-sm truncate">{client.address}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </a>
          )}

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Workspace checklist
            </Label>
            <div className="mt-2 space-y-1">
              {TRAVEL_ITEMS.map((item) => (
                <button
                  key={item}
                  onClick={() => setChecks((c) => ({ ...c, [item]: !c[item] }))}
                  className="w-full flex items-center gap-3 p-2 rounded-lg active:bg-accent text-left"
                >
                  <div
                    className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                      checks[item] ? "bg-primary border-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {checks[item] && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm">{item}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">Transport charge collected (500 KSH)</Label>
            <Switch checked={paid} onCheckedChange={setPaid} />
          </div>

          <div
            className={`rounded-lg p-4 text-center ${
              over ? "bg-red-50 border border-red-400" : warn ? "bg-amber-50 border border-amber-300" : "bg-muted"
            }`}
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Service timer · 10 min max
            </div>
            <div className="text-3xl font-mono">
              {String(min).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
            </div>
            {warn && (
              <div className="text-xs text-amber-700 mt-1">2 min left — upgrade to full service?</div>
            )}
            {over && (
              <div className="text-xs text-red-700 mt-1 font-medium">
                Over 10 min — must upgrade to full service
              </div>
            )}
          </div>

          <Button variant="outline" className="w-full">
            <Camera className="h-4 w-4 mr-2" /> Photo of completed nails
          </Button>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
