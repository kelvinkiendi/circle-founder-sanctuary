import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Crown,
  Plus,
  Sparkles,
  Wrench,
  Plane,
  Star,
  Cake,
  Gift,
  TrendingUp,
  Truck,
  Percent,
  Package,
  MapPin,
  Phone,
  Mail,
  Calendar as CalIcon,
  Clock,
  Lock,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Search,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/founders")({
  component: FoundersPage,
});

const TOTAL_SLOTS = 25;
const TERM_WEEKS = 26;
const TRAVEL_PER_TERM = 6;
const ENROLLMENT_FEE = 25000;

type Client = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  whatsapp_number: string | null;
  address: string | null;
  birthday: string | null;
};
type Founder = {
  id: string;
  client_id: string;
  founder_number: number | null;
  enrollment_date: string;
  term_end_date: string | null;
  status: "active" | "expired" | "pending";
  enrollment_fee_paid: boolean;
  payment_method: "full" | "installment" | null;
  installment_count: number | null;
  total_paid_ksh: number | null;
  engagement_score: number;
  clients: Client | null;
};

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function FoundersPage() {
  const [selected, setSelected] = useState<Founder | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data: founders } = useQuery({
    queryKey: ["founders-grid"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_circle")
        .select("*, clients(*)")
        .order("founder_number", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as Founder[];
    },
  });

  const byNumber = useMemo(() => {
    const map = new Map<number, Founder>();
    founders?.forEach((f) => f.founder_number && map.set(f.founder_number, f));
    return map;
  }, [founders]);

  const takenNumbers = useMemo(() => new Set(byNumber.keys()), [byNumber]);

  return (
    <Layout>
      <PageHeader
        eyebrow="The Circle · Founders"
        title="The Circle"
        description="Twenty-five seats. Six months. A founding chapter of COTERIE Nail Sanctuary."
        action={
          <Button onClick={() => setEnrollOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Enroll Founder
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1).map((num) => {
          const f = byNumber.get(num);
          return f ? (
            <FounderCard key={num} founder={f} onOpen={() => setSelected(f)} />
          ) : (
            <EmptySlot key={num} number={num} onClick={() => setEnrollOpen(true)} />
          );
        })}
      </div>

      {selected && (
        <FounderProfileModal
          founder={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />
      )}

      <EnrollFounderDialog
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        takenNumbers={takenNumbers}
      />
    </Layout>
  );
}

/* ---------- Grid cards ---------- */

function EmptySlot({ number, onClick }: { number: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative aspect-[3/4] border border-dashed border-border rounded-lg bg-card/40 hover:bg-card hover:border-gold/60 transition-colors flex flex-col items-center justify-center text-center p-4"
    >
      <Crown className="h-6 w-6 text-muted-foreground/40 group-hover:text-gold transition" />
      <div className="mt-3 font-display text-2xl text-muted-foreground/60">
        No. {String(number).padStart(2, "0")}
      </div>
      <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50 mt-2">
        Available
      </div>
      <div className="text-xs text-muted-foreground/60 mt-1 italic">Founding Position</div>
    </button>
  );
}

function FounderCard({ founder, onOpen }: { founder: Founder; onOpen: () => void }) {
  const term = computeTerm(founder);
  return (
    <button
      onClick={onOpen}
      className="group text-left aspect-[3/4] bg-card border border-border rounded-lg p-4 flex flex-col hover:border-gold transition-colors hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="text-[10px] tracking-[0.25em] uppercase text-gold">
          No. {String(founder.founder_number ?? 0).padStart(2, "0")}
        </div>
        <StatusBadge status={term.label} />
      </div>
      <div className="mt-3 w-14 h-14 rounded-full bg-secondary flex items-center justify-center font-display text-xl text-primary">
        {founder.clients?.full_name?.[0] ?? "?"}
      </div>
      <div className="mt-3 font-display text-lg leading-tight line-clamp-2">
        {founder.clients?.full_name ?? "Unknown"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        Joined {fmtDate(founder.enrollment_date)}
      </div>
      <div className="mt-auto pt-3 border-t border-border">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Term</div>
        <div className="text-sm font-medium">
          {term.daysLeft > 0 ? `${term.daysLeft} days left` : "Term ended"}
        </div>
      </div>
    </button>
  );
}

function computeTerm(f: Founder) {
  const end = f.term_end_date ? new Date(f.term_end_date) : null;
  const now = new Date();
  const daysLeft = end ? daysBetween(now, end) : 0;
  let label: "Active" | "Expiring" | "Expired" | "Pending" = "Active";
  if (f.status === "pending") label = "Pending";
  else if (!end || daysLeft <= 0) label = "Expired";
  else if (daysLeft <= 30) label = "Expiring";
  return { daysLeft, label, end };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Active: "bg-gold/15 text-gold border-gold/30",
    Expiring: "bg-destructive/10 text-destructive border-destructive/30",
    Expired: "bg-muted text-muted-foreground border-border",
    Pending: "bg-secondary text-secondary-foreground border-border",
  };
  return (
    <span
      className={`text-[9px] tracking-[0.2em] uppercase px-2 py-0.5 rounded-full border ${styles[status] ?? styles.Active}`}
    >
      {status}
    </span>
  );
}

/* ---------- Profile Modal ---------- */

function FounderProfileModal({
  founder,
  open,
  onClose,
}: {
  founder: Founder;
  open: boolean;
  onClose: () => void;
}) {
  const term = computeTerm(founder);
  const c = founder.clients;

  const { data: perks } = useQuery({
    queryKey: ["perks", founder.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("perks_usage")
        .select("*")
        .eq("founder_id", founder.id);
      return data ?? [];
    },
  });

  const { data: appointments } = useQuery({
    queryKey: ["founder-appts", founder.client_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("*")
        .eq("client_id", founder.client_id)
        .order("scheduled_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: surprises } = useQuery({
    queryKey: ["founder-surprises", founder.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("surprise_moments_log")
        .select("*")
        .eq("founder_id", founder.id)
        .order("awarded_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: purchases } = useQuery({
    queryKey: ["founder-purchases", founder.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("founder_purchases")
        .select("*, products(name)")
        .eq("founder_id", founder.id)
        .order("purchase_date", { ascending: false });
      return data ?? [];
    },
  });

  const counts = useMemo(() => {
    const list = perks ?? [];
    const by = (type: string) => list.filter((p: any) => p.perk_type === type);
    const used = (type: string) => by(type).filter((p: any) => p.status === "used").length;
    const forfeited = (type: string) => by(type).filter((p: any) => p.status === "forfeited").length;
    const lastUsed = (type: string) => {
      const u = by(type).filter((p: any) => p.used_date).sort((a: any, b: any) => (b.used_date > a.used_date ? 1 : -1));
      return u[0]?.used_date ?? null;
    };
    return {
      weeklyUsed: used("weekly_refresh"),
      weeklyForfeited: forfeited("weekly_refresh"),
      weeklyLast: lastUsed("weekly_refresh"),
      gelUsed: used("gel_rescue"),
      gelLast: lastUsed("gel_rescue"),
      travelUsed: used("travel_touchup"),
      surpriseUsed: used("surprise_full") + (surprises?.length ?? 0),
      upgradeUsed: used("random_upgrade"),
      birthday: by("birthday_sanctuary")[0],
    };
  }, [perks, surprises]);

  const birthdayCountdown = c?.birthday ? nextBirthdayDays(c.birthday) : null;
  const birthdayInTerm =
    c?.birthday && term.end
      ? isBirthdayInTerm(c.birthday, new Date(founder.enrollment_date), term.end)
      : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="text-[10px] tracking-[0.3em] uppercase text-gold">
              Founder No. {String(founder.founder_number ?? 0).padStart(2, "0")}
            </div>
            <StatusBadge status={term.label} />
          </div>
          <DialogTitle className="font-display text-3xl">
            {c?.full_name ?? "Unknown"}
          </DialogTitle>
          <DialogDescription>
            Enrolled {fmtDate(founder.enrollment_date)} · Term ends {fmtDate(founder.term_end_date)}{" "}
            {term.daysLeft > 0 && `(${term.daysLeft} days left)`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          {/* LEFT: Client info */}
          <div className="lg:col-span-3 space-y-4">
            <SectionTitle>Contact</SectionTitle>
            <InfoRow icon={Phone} label="Phone" value={c?.phone} />
            <InfoRow icon={Mail} label="Email" value={c?.email} />
            <InfoRow icon={Phone} label="WhatsApp" value={c?.whatsapp_number} />
            <InfoRow icon={MapPin} label="Address" value={c?.address} />

            <SectionTitle>Birthday</SectionTitle>
            <div className="bg-card border border-border rounded-md p-3">
              <div className="flex items-center gap-2 text-sm">
                <Cake className="h-4 w-4 text-gold" />
                {c?.birthday ? fmtDate(c.birthday) : "Not on file"}
              </div>
              {birthdayCountdown !== null && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {birthdayCountdown === 0
                    ? "🎉 Today!"
                    : `${birthdayCountdown} days until next birthday`}
                </div>
              )}
              <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {birthdayInTerm ? "Within term" : "Not applicable this term"}
              </div>
            </div>

            <SectionTitle>Payment</SectionTitle>
            <div className="bg-card border border-border rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="font-medium capitalize">{founder.payment_method ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">
                  {(founder.total_paid_ksh ?? 0).toLocaleString()} KSH
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee</span>
                <span>{ENROLLMENT_FEE.toLocaleString()} KSH</span>
              </div>
              {founder.payment_method === "installment" &&
                (founder.total_paid_ksh ?? 0) < ENROLLMENT_FEE && (
                  <div className="mt-2 text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    2nd installment due {fmtDate(addDays(founder.enrollment_date, 30))}
                  </div>
                )}
            </div>
          </div>

          {/* CENTER: Perks Dashboard */}
          <div className="lg:col-span-6">
            <SectionTitle>Perks Dashboard</SectionTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              <PerkTile
                icon={Sparkles}
                title="Weekly Refresh"
                primary={
                  <ProgressRing used={counts.weeklyUsed} total={TERM_WEEKS} />
                }
                meta={
                  <>
                    <div>Last: {fmtDate(counts.weeklyLast)}</div>
                    <div>No carryover · 24hr no-show forfeits</div>
                    {counts.weeklyForfeited > 0 && (
                      <div className="text-destructive flex items-center gap-1 mt-1">
                        <AlertTriangle className="h-3 w-3" />
                        {counts.weeklyForfeited} forfeited
                      </div>
                    )}
                  </>
                }
              />
              <PerkTile
                icon={Wrench}
                title="Gel Rescue"
                primary={<BigNumber n={counts.gelUsed} sub="repairs this term" />}
                meta={
                  <>
                    <div>Last repair: {fmtDate(counts.gelLast)}</div>
                    <div>7-day eligibility · 48hr report window</div>
                  </>
                }
              />
              <PerkTile
                icon={Plane}
                title="Travel Touch-Up"
                primary={
                  <BigNumber n={counts.travelUsed} sub={`of ${TRAVEL_PER_TERM} used`} />
                }
                meta={
                  <>
                    <div>10min · 48hr advance booking</div>
                    <div className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" /> Service area required
                    </div>
                  </>
                }
              />
              <PerkTile
                icon={Star}
                title="Priority Booking"
                primary={
                  <div className="flex items-center gap-2">
                    <Switch defaultChecked />
                    <span className="text-xs text-muted-foreground">48hr early access</span>
                  </div>
                }
                meta={<div>Priority window active for all bookings</div>}
              />
              <PerkTile
                icon={Cake}
                title="Birthday Sanctuary"
                primary={
                  <BigNumber
                    n={
                      counts.birthday?.status === "used"
                        ? "Used"
                        : birthdayInTerm
                          ? "Available"
                          : "N/A"
                    }
                    sub=""
                  />
                }
                meta={
                  <>
                    <div>7-day window (3 before / 3 after)</div>
                    <div>Includes gift bag</div>
                  </>
                }
              />
              <PerkTile
                icon={Gift}
                title="Surprise Full Manicure"
                primary={
                  <BigNumber n={counts.surpriseUsed} sub="of ~2 awarded" locked={counts.surpriseUsed === 0} />
                }
                meta={<div>COTERIE-awarded · mystery release</div>}
              />
              <PerkTile
                icon={TrendingUp}
                title="Random Upgrade"
                primary={<BigNumber n={counts.upgradeUsed} sub="of 2 used" />}
                meta={<div>60-day duplicate prevention</div>}
              />
              <PerkTile
                icon={Truck}
                title="Just Because Delivery"
                primary={
                  <div className="font-display text-xl">
                    {founder.engagement_score >= 75 ? "Eligible" : "Building"}
                  </div>
                }
                meta={
                  <div>
                    Engagement score: {founder.engagement_score} · Top 5 receive
                  </div>
                }
              />
              <PerkTile
                icon={Percent}
                title="Founder Rate"
                primary={
                  <div className="flex items-center gap-2">
                    <div className="font-display text-3xl text-gold">15%</div>
                    <div className="text-xs text-muted-foreground">off</div>
                  </div>
                }
                meta={<div>1 service per 12 months · relationship tracked</div>}
              />
              <PerkTile
                icon={Package}
                title="Product Vault"
                primary={
                  <BigNumber
                    n={purchases?.length ?? 0}
                    sub="units purchased"
                  />
                }
                meta={<div>Pre-launch access · max 2 per product</div>}
              />
            </div>
          </div>

          {/* RIGHT: Timeline */}
          <div className="lg:col-span-3">
            <SectionTitle>Activity Timeline</SectionTitle>
            <Timeline
              appointments={appointments ?? []}
              perks={perks ?? []}
              surprises={surprises ?? []}
              purchases={purchases ?? []}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] tracking-[0.3em] uppercase text-gold mb-2">{children}</div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div className="truncate">{value || "—"}</div>
      </div>
    </div>
  );
}

function PerkTile({
  icon: Icon,
  title,
  primary,
  meta,
}: {
  icon: any;
  title: string;
  primary: React.ReactNode;
  meta: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gold" />
        <div className="font-display text-base">{title}</div>
      </div>
      <div className="mb-2">{primary}</div>
      <div className="text-[11px] text-muted-foreground leading-relaxed">{meta}</div>
    </div>
  );
}

function BigNumber({
  n,
  sub,
  locked,
}: {
  n: number | string;
  sub: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      {locked ? (
        <Lock className="h-5 w-5 text-muted-foreground" />
      ) : (
        <div className="font-display text-3xl text-primary">{n}</div>
      )}
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ProgressRing({ used, total }: { used: number; total: number }) {
  const pct = Math.min(100, (used / total) * 100);
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
        <text
          x="32"
          y="36"
          textAnchor="middle"
          fontSize="14"
          fill="var(--primary)"
          fontFamily="Cormorant Garamond"
        >
          {used}
        </text>
      </svg>
      <div className="text-xs">
        <div className="font-medium">
          {used} of {total}
        </div>
        <div className="text-muted-foreground">weeks used</div>
      </div>
    </div>
  );
}

function Timeline({
  appointments,
  perks,
  surprises,
  purchases,
}: {
  appointments: any[];
  perks: any[];
  surprises: any[];
  purchases: any[];
}) {
  const events = useMemo(() => {
    const e: { date: string; kind: string; label: string }[] = [];
    appointments.forEach((a) =>
      e.push({
        date: a.scheduled_date,
        kind: "appointment",
        label: `${a.appointment_type.replace(/_/g, " ")} · ${a.status}`,
      }),
    );
    perks
      .filter((p) => p.used_date)
      .forEach((p) =>
        e.push({
          date: p.used_date,
          kind: "perk",
          label: `${p.perk_type.replace(/_/g, " ")} redeemed`,
        }),
      );
    surprises.forEach((s) =>
      e.push({
        date: s.awarded_date,
        kind: "surprise",
        label: `Surprise: ${s.surprise_type}`,
      }),
    );
    purchases.forEach((p) =>
      e.push({
        date: p.purchase_date,
        kind: "purchase",
        label: `Bought ${p.products?.name ?? "product"} × ${p.quantity}`,
      }),
    );
    return e.sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 30);
  }, [appointments, perks, surprises, purchases]);

  if (!events.length)
    return (
      <div className="text-sm italic text-muted-foreground py-8 text-center">
        No activity yet.
      </div>
    );

  const iconFor: Record<string, any> = {
    appointment: CalIcon,
    perk: Sparkles,
    surprise: Gift,
    purchase: Package,
  };

  return (
    <ol className="relative border-l border-border ml-2 space-y-3 mt-2">
      {events.map((ev, i) => {
        const Icon = iconFor[ev.kind] ?? CircleDot;
        return (
          <li key={i} className="pl-4">
            <span className="absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full bg-card border border-gold">
              <Icon className="h-2 w-2 text-gold" />
            </span>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {fmtDate(ev.date)}
            </div>
            <div className="text-sm capitalize">{ev.label}</div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Enrollment ---------- */

function EnrollFounderDialog({
  open,
  onClose,
  takenNumbers,
}: {
  open: boolean;
  onClose: () => void;
  takenNumbers: Set<number>;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [newClient, setNewClient] = useState({
    full_name: "",
    phone: "",
    email: "",
    whatsapp_number: "",
    birthday: "",
    address: "",
  });
  const [founderNumber, setFounderNumber] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"full" | "installment">("full");
  const [firstInstallment, setFirstInstallment] = useState(String(ENROLLMENT_FEE / 2));
  const [enrollmentDate, setEnrollmentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");

  const { data: clientResults } = useQuery({
    queryKey: ["client-search", search],
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, phone").limit(8);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open && mode === "existing",
  });

  const availableNumbers = useMemo(
    () =>
      Array.from({ length: TOTAL_SLOTS }, (_, i) => i + 1).filter((n) => !takenNumbers.has(n)),
    [takenNumbers],
  );

  const enroll = useMutation({
    mutationFn: async () => {
      if (!founderNumber) throw new Error("Select a founder number");

      let useClientId = clientId;

      if (mode === "new") {
        if (!newClient.full_name.trim()) throw new Error("Client name is required");
        const { data: created, error } = await supabase
          .from("clients")
          .insert({
            ...newClient,
            birthday: newClient.birthday || null,
            client_type: "founder",
          })
          .select()
          .single();
        if (error) throw error;
        useClientId = created.id;
      } else {
        if (!useClientId) throw new Error("Select an existing client");
        await supabase.from("clients").update({ client_type: "founder" }).eq("id", useClientId);
      }

      const enrollDate = new Date(enrollmentDate);
      const termEnd = new Date(enrollDate);
      termEnd.setMonth(termEnd.getMonth() + 6);

      const totalPaid =
        paymentMethod === "full" ? ENROLLMENT_FEE : Number(firstInstallment || 0);

      const { data: founder, error: fErr } = await supabase
        .from("founder_circle")
        .insert({
          client_id: useClientId,
          founder_number: Number(founderNumber),
          enrollment_date: enrollmentDate,
          term_end_date: termEnd.toISOString().slice(0, 10),
          enrollment_fee_paid: paymentMethod === "full",
          payment_method: paymentMethod,
          installment_count: paymentMethod === "installment" ? 1 : 0,
          total_paid_ksh: totalPaid,
          status: "active",
        })
        .select()
        .single();
      if (fErr) throw fErr;

      // Auto-create perk records
      const perkRows: any[] = [];
      for (let w = 1; w <= TERM_WEEKS; w++) {
        perkRows.push({
          founder_id: founder.id,
          perk_type: "weekly_refresh",
          week_number: w,
          status: "available",
        });
      }
      for (let m = 1; m <= TRAVEL_PER_TERM; m++) {
        perkRows.push({
          founder_id: founder.id,
          perk_type: "travel_touchup",
          month_number: m,
          status: "available",
        });
      }
      perkRows.push({
        founder_id: founder.id,
        perk_type: "birthday_sanctuary",
        status: "available",
      });
      await supabase.from("perks_usage").insert(perkRows);

      return founder;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["founders-grid"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success("Founder enrolled. Welcome to The Circle.", {
        description: "WhatsApp welcome message queued (placeholder).",
      });
      onClose();
      // reset
      setClientId("");
      setFounderNumber("");
      setNewClient({
        full_name: "",
        phone: "",
        email: "",
        whatsapp_number: "",
        birthday: "",
        address: "",
      });
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message ?? "Enrollment failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="text-[10px] tracking-[0.3em] uppercase text-gold">Enrollment</div>
          <DialogTitle className="font-display text-3xl">Enroll a Founder</DialogTitle>
          <DialogDescription>
            Initiate a six-month founding seat. {availableNumbers.length} of {TOTAL_SLOTS} seats remain.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="existing">Existing Client</TabsTrigger>
            <TabsTrigger value="new">New Client</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 mt-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search by name…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="border border-border rounded-md max-h-48 overflow-y-auto divide-y divide-border">
              {clientResults?.length ? (
                clientResults.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setClientId(c.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-accent ${clientId === c.id ? "bg-accent" : ""}`}
                  >
                    <div className="font-medium">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.phone ?? "no phone"}</div>
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-sm text-center text-muted-foreground italic">
                  No clients found.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Full Name *">
                <Input
                  value={newClient.full_name}
                  onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                />
              </Field>
              <Field label="WhatsApp">
                <Input
                  value={newClient.whatsapp_number}
                  onChange={(e) =>
                    setNewClient({ ...newClient, whatsapp_number: e.target.value })
                  }
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                />
              </Field>
              <Field label="Birthday">
                <Input
                  type="date"
                  value={newClient.birthday}
                  onChange={(e) => setNewClient({ ...newClient, birthday: e.target.value })}
                />
              </Field>
              <Field label="Address">
                <Input
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                />
              </Field>
            </div>
          </TabsContent>
        </Tabs>

        <div className="border-t border-border pt-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Founder Number">
              <Select value={founderNumber} onValueChange={setFounderNumber}>
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {availableNumbers.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      No. {String(n).padStart(2, "0")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Enrollment Date">
              <Input
                type="date"
                value={enrollmentDate}
                onChange={(e) => setEnrollmentDate(e.target.value)}
              />
            </Field>
            <Field label={`Enrollment Fee (${ENROLLMENT_FEE.toLocaleString()} KSH)`}>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Payment</SelectItem>
                  <SelectItem value="installment">2 Installments</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {paymentMethod === "installment" && (
              <Field label="First Installment (KSH)">
                <Input
                  type="number"
                  value={firstInstallment}
                  onChange={(e) => setFirstInstallment(e.target.value)}
                />
              </Field>
            )}
          </div>

          {paymentMethod === "installment" && (
            <div className="bg-accent/40 border border-border rounded-md p-3 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="h-3 w-3" /> 2nd installment reminder
              </div>
              <div className="mt-1 text-muted-foreground">
                Balance of{" "}
                {(ENROLLMENT_FEE - Number(firstInstallment || 0)).toLocaleString()} KSH due{" "}
                {fmtDate(addDays(enrollmentDate, 30))}.
              </div>
            </div>
          )}

          <Field label="Notes (optional)">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this founder…"
            />
          </Field>

          <div className="bg-gold/10 border border-gold/30 rounded-md p-3 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-gold mt-0.5" />
            <div>
              On enrollment we'll auto-create 26 weekly refreshes, 6 travel touch-ups, and 1 birthday sanctuary,
              calculate the term end date, and queue a WhatsApp welcome message.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => enroll.mutate()} disabled={enroll.isPending}>
            {enroll.isPending ? "Enrolling…" : "Enroll Founder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

/* ---------- helpers ---------- */
function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function nextBirthdayDays(bday: string) {
  const today = new Date();
  const b = new Date(bday);
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate())) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return daysBetween(today, next);
}
function isBirthdayInTerm(bday: string, start: Date, end: Date) {
  const b = new Date(bday);
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    const candidate = new Date(y, b.getMonth(), b.getDate());
    if (candidate >= start && candidate <= end) return true;
  }
  return false;
}
