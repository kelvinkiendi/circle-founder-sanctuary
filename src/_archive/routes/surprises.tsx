import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Sparkles, Cake, Search, Package, AlertTriangle, Calendar, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";


type SurpriseType = "surprise_full" | "random_upgrade" | "just_because";

const SURPRISE_META: Record<SurpriseType, { label: string; cost: number; description: string; icon: any }> = {
  surprise_full: {
    label: "Surprise Full Manicure",
    cost: 3500,
    description: "Morning-of upgrade from Weekly Refresh to full Sanctuary Session.",
    icon: Sparkles,
  },
  random_upgrade: {
    label: "Random Upgrade",
    cost: 1500,
    description: "Mid-service: add gel, art, or paraffin treatment.",
    icon: Gift,
  },
  just_because: {
    label: "Just Because Delivery",
    cost: 2500,
    description: "Curated delivery to top 5 founders by engagement.",
    icon: Package,
  },
};

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function SurprisesPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Command Center"
        title="Surprise Moments"
        description="Award gestures, manage birthday sanctuaries, and track delight investment."
      />
      <Tabs defaultValue="surprises">
        <TabsList className="mb-6">
          <TabsTrigger value="surprises">Surprise Command</TabsTrigger>
          <TabsTrigger value="birthdays">Birthday Sanctuary</TabsTrigger>
          <TabsTrigger value="history">Log & Budget</TabsTrigger>
        </TabsList>
        <TabsContent value="surprises"><SurpriseCommandCenter /></TabsContent>
        <TabsContent value="birthdays"><BirthdayManager /></TabsContent>
        <TabsContent value="history"><SurpriseLog /></TabsContent>
      </Tabs>
    </Layout>
  );
}

/* -------- Surprise Command Center -------- */

function SurpriseCommandCenter() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedFounderId, setSelectedFounderId] = useState<string | null>(null);
  const [type, setType] = useState<SurpriseType>("surprise_full");
  const [reason, setReason] = useState("");
  const [documentedBy, setDocumentedBy] = useState("COTERIE");
  const [open, setOpen] = useState(false);

  const { data: founders = [] } = useQuery({
    queryKey: ["founders-with-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_circle")
        .select("*, clients(*)")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: apptCounts = {} } = useQuery({
    queryKey: ["appt-counts"],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("client_id, status");
      const counts: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        if (a.status === "completed") counts[a.client_id] = (counts[a.client_id] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: recentSurprises = [] } = useQuery({
    queryKey: ["recent-surprises"],
    queryFn: async () => {
      const sixtyAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
      const { data } = await supabase
        .from("surprise_moments_log")
        .select("*")
        .gte("awarded_date", sixtyAgo);
      return data || [];
    },
  });

  const enriched = useMemo(() => {
    return founders
      .map((f: any) => ({
        ...f,
        bookings: apptCounts[f.client_id] || 0,
        engagement: Number(f.engagement_score || 0),
        spend: Number(f.total_spend || 0),
        referrals: f.referral_count || 0,
      }))
      .filter((f: any) =>
        f.clients?.full_name?.toLowerCase().includes(search.toLowerCase()),
      );
  }, [founders, apptCounts, search]);

  const top5 = useMemo(
    () =>
      [...enriched].sort(
        (a, b) =>
          b.engagement - a.engagement || b.spend - a.spend || b.referrals - a.referrals,
      ).slice(0, 5),
    [enriched],
  );

  const selected = enriched.find((f: any) => f.id === selectedFounderId);
  const recentForSelected = recentSurprises.filter(
    (s: any) => s.founder_id === selectedFounderId && s.surprise_type === "random_upgrade",
  );
  const upgradeBlocked = type === "random_upgrade" && recentForSelected.length > 0;

  const award = useMutation({
    mutationFn: async () => {
      if (!selectedFounderId) throw new Error("Select a founder");
      const { error } = await supabase.from("surprise_moments_log").insert({
        founder_id: selectedFounderId,
        surprise_type: type,
        awarded_reason: reason,
        documented_by: documentedBy,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Surprise awarded — documented in the log.");
      qc.invalidateQueries({ queryKey: ["recent-surprises"] });
      setOpen(false);
      setReason("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search founders by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={type} onValueChange={(v: SurpriseType) => setType(v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SURPRISE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === "just_because" && (
            <div className="mb-4 p-4 bg-gold/10 border border-gold/30 rounded-md">
              <div className="text-xs uppercase tracking-widest text-gold mb-2">
                Auto-filtered: Top 5 by engagement
              </div>
              <div className="space-y-1">
                {top5.map((f: any, i: number) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFounderId(f.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm flex justify-between ${
                      selectedFounderId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <span>#{i + 1} · {f.clients?.full_name}</span>
                    <span className="text-xs opacity-70">
                      eng {f.engagement.toFixed(1)} · {f.spend.toLocaleString()} KSH
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto">
            {enriched.map((f: any) => (
              <button
                key={f.id}
                onClick={() => setSelectedFounderId(f.id)}
                className={`text-left p-3 rounded-md border transition-colors ${
                  selectedFounderId === f.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="font-medium text-sm">{f.clients?.full_name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap">
                  <span>{f.bookings} visits</span>
                  <span>{f.referrals} refs</span>
                  <span>eng {f.engagement.toFixed(1)}</span>
                </div>
              </button>
            ))}
            {enriched.length === 0 && (
              <div className="col-span-2 text-center py-10 text-sm text-muted-foreground">
                No active founders match your search.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Award Surprise
          </div>
          {selected ? (
            <>
              <div className="font-display text-2xl">{selected.clients?.full_name}</div>
              <div className="text-xs text-muted-foreground mb-4">
                Founder #{selected.founder_number ?? "—"} · enrolled {selected.enrollment_date}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <Stat label="Bookings" value={String(selected.bookings)} />
                <Stat label="Referrals" value={String(selected.referrals)} />
                <Stat label="Spend (KSH)" value={selected.spend.toLocaleString()} />
                <Stat label="Engagement" value={selected.engagement.toFixed(1)} />
              </div>
              <div className="p-3 bg-background rounded-md border border-border mb-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {(() => {
                    const Icon = SURPRISE_META[type].icon;
                    return <Icon className="h-4 w-4 text-gold" />;
                  })()}
                  {SURPRISE_META[type].label}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {SURPRISE_META[type].description}
                </div>
                <div className="text-xs mt-2">
                  Est. cost: <span className="font-medium">{SURPRISE_META[type].cost.toLocaleString()} KSH</span>
                </div>
              </div>

              {type === "surprise_full" && (
                <div className="p-3 bg-secondary/40 rounded-md text-xs mb-3 italic">
                  Template: "Your Refresh today is becoming a full Sanctuary Session. See you soon. — COTERIE"
                </div>
              )}
              {upgradeBlocked && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-xs mb-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span>
                    Random Upgrade awarded within last 60 days. Choose a different surprise to avoid duplication.
                  </span>
                </div>
              )}

              <Button
                disabled={upgradeBlocked}
                className="w-full"
                onClick={() => setOpen(true)}
              >
                Award Surprise
              </Button>
            </>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-10">
              Select a founder to award a surprise moment.
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Surprise Budget · last 60d
          </div>
          {Object.entries(SURPRISE_META).map(([k, v]) => {
            const count = recentSurprises.filter((s: any) => s.surprise_type === k).length;
            return (
              <div key={k} className="flex justify-between text-sm py-1.5 border-b border-border last:border-0">
                <span>{v.label}</span>
                <span className="font-medium">
                  {count} · {(count * v.cost).toLocaleString()} KSH
                </span>
              </div>
            );
          })}
          <div className="flex justify-between text-sm pt-3 mt-2 border-t border-border">
            <span className="font-medium">Total invested</span>
            <span className="font-medium text-gold">
              {recentSurprises
                .reduce((sum: number, s: any) => sum + (SURPRISE_META[s.surprise_type as SurpriseType]?.cost || 0), 0)
                .toLocaleString()}{" "}
              KSH
            </span>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document the surprise</DialogTitle>
            <DialogDescription>
              Internal record — visible only to COTERIE.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Reason for award</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Brought two referrals this month, exceptional loyalty"
                rows={3}
              />
            </div>
            <div>
              <Label>Documented by</Label>
              <Input value={documentedBy} onChange={(e) => setDocumentedBy(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => award.mutate()} disabled={award.isPending || !reason.trim()}>
              {award.isPending ? "Recording..." : "Confirm & Award"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded bg-secondary/40">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-medium text-sm">{value}</div>
    </div>
  );
}

/* -------- Birthday Sanctuary Manager -------- */

function BirthdayManager() {
  const { data: founders = [] } = useQuery({
    queryKey: ["birthday-founders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("founder_circle")
        .select("*, clients(*)")
        .eq("status", "active");
      if (error) throw error;
      return data || [];
    },
  });

  const upcoming = useMemo(() => {
    const today = new Date();
    return (founders as any[])
      .filter((f) => f.clients?.birthday)
      .map((f) => {
        const bd = new Date(f.clients.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const days = daysBetween(today, next);
        const termEnd = f.term_end_date ? new Date(f.term_end_date) : null;
        const inTerm = termEnd ? next <= termEnd : true;
        return { ...f, nextBd: next, daysUntil: days, inTerm };
      })
      .filter((f) => f.daysUntil <= 30)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [founders]);

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Cake className="h-4 w-4 text-gold" />
          <div className="font-display text-xl">Upcoming Birthday Sanctuaries</div>
        </div>
        <div className="text-xs text-muted-foreground mb-5">
          Next 30 days · Birthday week = 3 days before through 3 days after.
        </div>

        {upcoming.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No founder birthdays in the next 30 days.
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((f: any) => {
              const inWeek = f.daysUntil <= 3;
              return (
                <div
                  key={f.id}
                  className={`p-4 rounded-md border ${
                    !f.inTerm
                      ? "border-border bg-muted/30 opacity-60"
                      : inWeek
                      ? "border-gold bg-gold/5"
                      : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">{f.clients?.full_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Birthday {f.nextBd.toLocaleDateString(undefined, { month: "long", day: "numeric" })} ·{" "}
                        {f.daysUntil === 0 ? "Today" : `${f.daysUntil} days away`}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {!f.inTerm ? (
                        <Badge variant="outline" className="text-muted-foreground">Term Expired</Badge>
                      ) : inWeek ? (
                        <Badge className="bg-gold text-gold-foreground">Birthday Week</Badge>
                      ) : (
                        <Badge variant="outline">Upcoming</Badge>
                      )}
                      {f.inTerm && (
                        <Badge variant="secondary" className="text-[10px]">
                          Gift bag: cuticle oil + clasp
                        </Badge>
                      )}
                    </div>
                  </div>
                  {f.inTerm && (
                    <div className="mt-3 flex gap-2 text-xs">
                      <Badge variant="outline" className="border-dashed">
                        <Clock className="h-3 w-3 mr-1" /> Book ≥ 7d advance
                      </Badge>
                      <Badge variant="outline">Status: Pending</Badge>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------- Surprise Log -------- */

function SurpriseLog() {
  const { data: log = [] } = useQuery({
    queryKey: ["surprise-log-full"],
    queryFn: async () => {
      const { data } = await supabase
        .from("surprise_moments_log")
        .select("*, founder_circle:founder_id(clients(full_name))")
        .order("awarded_date", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="font-display text-xl mb-4 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gold" /> Surprise History
      </div>
      {log.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10">
          No surprises awarded yet.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {log.map((s: any) => (
            <div key={s.id} className="py-3 flex justify-between gap-4">
              <div>
                <div className="text-sm font-medium">
                  {s.founder_circle?.clients?.full_name || "—"}
                </div>
                <div className="text-xs text-muted-foreground italic mt-0.5">
                  {s.awarded_reason || "No reason recorded"}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  by {s.documented_by || "—"}
                </div>
              </div>
              <div className="text-right">
                <Badge variant="outline">
                  {SURPRISE_META[s.surprise_type as SurpriseType]?.label || s.surprise_type}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">{s.awarded_date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
