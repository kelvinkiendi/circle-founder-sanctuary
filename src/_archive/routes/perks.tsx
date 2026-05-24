import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, AlertTriangle, Trophy, Sparkles, Bell, Clock, Plane, Cake, Wrench, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";


const FOUNDER_FEE = 25000;
const SERVICE_COST = 1500;
const SURPRISE_AVG_COST = 2000;

export function PerksAnalyticsPage() {
  return (
    <Layout>
      <PageHeader
        eyebrow="Insight"
        title="Perks · Analytics · Notifications"
        description="Utilisation, ROI, churn risk, leaderboard, and the alert queue."
      />
      <Tabs defaultValue="analytics">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics & ROI</TabsTrigger>
          <TabsTrigger value="utilisation">Perk Utilisation</TabsTrigger>
          <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="utilisation"><UtilisationTab /></TabsContent>
        <TabsContent value="leaderboard"><LeaderboardTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
      </Tabs>
    </Layout>
  );
}

function useFoundersWithData() {
  return useQuery({
    queryKey: ["founders-analytics"],
    queryFn: async () => {
      const [founders, perks, surprises, purchases] = await Promise.all([
        supabase.from("founder_circle").select("*, clients(*)"),
        supabase.from("perks_usage").select("*"),
        supabase.from("surprise_moments_log").select("*"),
        supabase.from("founder_purchases").select("*"),
      ]);
      return {
        founders: founders.data || [],
        perks: perks.data || [],
        surprises: surprises.data || [],
        purchases: purchases.data || [],
      };
    },
  });
}

function AnalyticsTab() {
  const { data } = useFoundersWithData();
  if (!data) return <Loading />;

  const active = data.founders.filter((f: any) => f.status === "active");
  const revenue = active.length * FOUNDER_FEE;
  const serviceUsage = data.perks.filter((p: any) => p.status === "used").length;
  const serviceCost = serviceUsage * SERVICE_COST;
  const surpriseCost = data.surprises.length * SURPRISE_AVG_COST;
  const productRevenue = data.purchases.reduce((s: number, p: any) => s + Number(p.price_applied || 0), 0);
  const netMargin = revenue + productRevenue - serviceCost - surpriseCost;
  const marginPct = revenue > 0 ? ((netMargin / (revenue + productRevenue)) * 100).toFixed(1) : "—";

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard label="Active Founders" value={`${active.length} / 25`} icon={Sparkles} />
      <MetricCard label="Circle Revenue" value={`${revenue.toLocaleString()} KSH`} icon={TrendingUp} />
      <MetricCard label="Service Cost" value={`${serviceCost.toLocaleString()} KSH`} muted />
      <MetricCard label="Surprise Cost" value={`${surpriseCost.toLocaleString()} KSH`} muted />
      <MetricCard label="Product Revenue" value={`${productRevenue.toLocaleString()} KSH`} />
      <MetricCard label="Perks Used" value={String(serviceUsage)} />
      <MetricCard label="Surprises Awarded" value={String(data.surprises.length)} />
      <MetricCard label="Net Margin" value={`${netMargin.toLocaleString()} KSH`} accent subline={`${marginPct}% margin`} />
    </div>
  );
}

function UtilisationTab() {
  const { data } = useFoundersWithData();
  if (!data) return <Loading />;

  const types = ["weekly_refresh", "gel_rescue", "travel_touchup", "birthday_sanctuary"] as const;
  const labels: Record<string, { label: string; icon: any }> = {
    weekly_refresh: { label: "Weekly Refresh", icon: Sparkles },
    gel_rescue: { label: "Gel Rescue", icon: Wrench },
    travel_touchup: { label: "Travel Touch-Up", icon: Plane },
    birthday_sanctuary: { label: "Birthday Sanctuary", icon: Cake },
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      {types.map((t) => {
        const all = data.perks.filter((p: any) => p.perk_type === t);
        const used = all.filter((p: any) => p.status === "used").length;
        const forfeited = all.filter((p: any) => p.status === "forfeited").length;
        const total = all.length;
        const pct = total > 0 ? Math.round((used / total) * 100) : 0;
        const Icon = labels[t].icon;
        return (
          <div key={t} className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-4 w-4 text-gold" />
              <div className="font-medium">{labels[t].label}</div>
            </div>
            <div className="flex items-end gap-2 mb-2">
              <div className="font-display text-4xl">{pct}%</div>
              <div className="text-xs text-muted-foreground mb-1">utilisation</div>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3">
              <span>Used {used}</span>
              <span>Forfeited {forfeited}</span>
              <span>Total {total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LeaderboardTab() {
  const { data } = useFoundersWithData();
  if (!data) return <Loading />;

  const ranked = [...data.founders]
    .filter((f: any) => f.status === "active")
    .map((f: any) => ({
      ...f,
      score: Number(f.engagement_score || 0) * 10 + Number(f.total_spend || 0) / 1000 + (f.referral_count || 0) * 5,
    }))
    .sort((a, b) => b.score - a.score);

  const today = new Date();
  const churnRisk = data.founders.filter((f: any) => {
    if (f.status !== "active" || !f.term_end_date) return false;
    const days = Math.round((new Date(f.term_end_date).getTime() - today.getTime()) / 86400000);
    return days >= 0 && days <= 30;
  });

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-gold" />
          <div className="font-display text-xl">Top 5 · Just Because eligible</div>
        </div>
        <div className="space-y-2">
          {ranked.slice(0, 5).map((f: any, i: number) => (
            <div key={f.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/40">
              <div className="font-display text-2xl text-gold w-8">{i + 1}</div>
              <div className="flex-1">
                <div className="font-medium text-sm">{f.clients?.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {f.referral_count} refs · {Number(f.total_spend).toLocaleString()} KSH · eng {Number(f.engagement_score).toFixed(1)}
                </div>
              </div>
            </div>
          ))}
          {ranked.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No active founders yet.</div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <div className="font-display text-xl">Churn risk · term ending ≤ 30d</div>
        </div>
        {churnRisk.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">No founders nearing term end.</div>
        ) : (
          <div className="space-y-2">
            {churnRisk.map((f: any) => {
              const days = Math.round((new Date(f.term_end_date).getTime() - today.getTime()) / 86400000);
              return (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div>
                    <div className="font-medium text-sm">{f.clients?.full_name}</div>
                    <div className="text-xs text-muted-foreground">Term ends {f.term_end_date}</div>
                  </div>
                  <Badge variant={days <= 7 ? "destructive" : "outline"}>{days}d</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const { data } = useFoundersWithData();

  const alerts = useMemo(() => {
    if (!data) return [];
    const today = new Date();
    const out: { kind: string; text: string; severity: "info" | "warn" | "alert"; icon: any }[] = [];

    data.founders.forEach((f: any) => {
      if (f.status !== "active") return;
      if (f.term_end_date) {
        const days = Math.round((new Date(f.term_end_date).getTime() - today.getTime()) / 86400000);
        if (days >= 0 && days <= 30) {
          out.push({
            kind: "term",
            text: `${f.clients?.full_name} · term ends in ${days}d`,
            severity: days <= 7 ? "alert" : "warn",
            icon: Clock,
          });
        }
      }
      if (f.clients?.birthday) {
        const bd = new Date(f.clients.birthday);
        const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const days = Math.round((next.getTime() - today.getTime()) / 86400000);
        if (days <= 10 && days >= 0) {
          out.push({
            kind: "birthday",
            text: `${f.clients?.full_name} · birthday in ${days}d — book sanctuary`,
            severity: "info",
            icon: Cake,
          });
        }
      }
    });

    const now = today.getTime();
    data.perks.forEach((p: any) => {
      if (p.status !== "available") return;
      if (p.perk_type === "gel_rescue" && p.expiry_date) {
        const days = Math.round((new Date(p.expiry_date).getTime() - now) / 86400000);
        if (days >= 0 && days <= 2) {
          out.push({
            kind: "rescue",
            text: `Gel rescue window closes in ${days}d`,
            severity: "alert",
            icon: Wrench,
          });
        }
      }
      if (p.perk_type === "travel_touchup" && p.expiry_date) {
        const days = Math.round((new Date(p.expiry_date).getTime() - now) / 86400000);
        if (days <= 5 && days >= 0) {
          out.push({
            kind: "travel",
            text: `Travel touch-up unbooked · ${days}d to month end`,
            severity: "warn",
            icon: Plane,
          });
        }
      }
    });

    return out;
  }, [data]);

  if (!data) return <Loading />;

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="h-4 w-4 text-gold" />
        <div className="font-display text-xl">Notification Center</div>
        <Badge variant="outline" className="ml-auto">{alerts.length} active</Badge>
      </div>
      {alerts.length === 0 ? (
        <div className="text-sm text-muted-foreground text-center py-10">All clear — no pending alerts.</div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a, i) => {
            const Icon = a.icon;
            const tone =
              a.severity === "alert"
                ? "border-destructive/40 bg-destructive/5"
                : a.severity === "warn"
                ? "border-gold/40 bg-gold/5"
                : "border-border";
            return (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-md border ${tone}`}>
                <Icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 text-sm">{a.text}</div>
                <Badge variant="outline" className="text-[10px]">WhatsApp · in-app</Badge>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 text-[10px] text-muted-foreground flex items-center gap-1">
        <Gift className="h-3 w-3" /> WhatsApp + in-app delivery hooks pending integration.
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  muted,
  accent,
  subline,
}: {
  label: string;
  value: string;
  icon?: any;
  muted?: boolean;
  accent?: boolean;
  subline?: string;
}) {
  return (
    <div
      className={`p-5 rounded-lg border ${
        accent ? "bg-gold/10 border-gold/40" : muted ? "bg-secondary/30 border-border" : "bg-card border-border"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <div className="font-display text-2xl mt-2">{value}</div>
      {subline && <div className="text-xs text-muted-foreground mt-1">{subline}</div>}
    </div>
  );
}

function Loading() {
  return <div className="text-sm text-muted-foreground py-10 text-center">Loading…</div>;
}
