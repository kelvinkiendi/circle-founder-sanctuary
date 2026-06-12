import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Wallet, AlertTriangle, ShieldAlert, Users, Clock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { getAuditSummaryFn } from "@/lib/audit.functions";
import { useSession } from "@/lib/session";

function fmtKsh(n: number) {
  return `KSH ${Math.round(n).toLocaleString()}`;
}

function relative(ts: string) {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function PartnerAuditSnapshot({ onOpenAudit }: { onOpenAudit?: () => void }) {
  const { session } = useSession();
  const fetchSummary = useServerFn(getAuditSummaryFn);
  const { data: s, isLoading } = useQuery({
    queryKey: ["audit-summary", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => fetchSummary({ data: { sessionId: session!.sessionId } }),
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        eyebrow="The Partner · Snapshot"
        title="Audit & operations, at a glance."
        description="Read-only view of activity, revenue, payment health, and staff access."
        action={
          onOpenAudit ? (
            <Button variant="outline" size="sm" onClick={onOpenAudit}>
              Open full audit log
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard label="Revenue Today" value={isLoading ? "—" : fmtKsh(s?.paidTodayKsh ?? 0)} hint="M-Pesa confirmed" icon={Wallet} accent="gold" />
        <StatCard label="Revenue · 7 days" value={isLoading ? "—" : fmtKsh(s?.paid7Ksh ?? 0)} hint="Rolling weekly total" icon={Wallet} />
        <StatCard label="Activity Events · 7d" value={s?.events7 ?? "—"} hint={`${s?.events30 ?? 0} in last 30 days`} icon={Activity} />
        <StatCard label="Active Staff" value={s?.activeStaff ?? "—"} hint="Currently enabled" icon={Users} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <StatCard label="Failed Payments · 7d" value={s?.failedPayments7 ?? "—"} hint="failed or cancelled" icon={AlertTriangle} accent="gold" />
        <StatCard label="Failed Logins · 7d" value={s?.loginFails7 ?? "—"} hint="bad PIN or locked attempts" icon={ShieldAlert} />
        <StatCard label="Locked Staff" value={s?.lockedStaff ?? "—"} hint="currently locked out" icon={ShieldAlert} />
      </div>

      <section className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl">Recent Activity</h2>
          {onOpenAudit && (
            <Button variant="ghost" size="sm" onClick={onOpenAudit}>View all →</Button>
          )}
        </div>
        {s?.recentEvents?.length ? (
          <ul className="divide-y divide-border">
            {s.recentEvents.map((e: any) => (
              <li key={e.id} className="py-3 flex items-start gap-4">
                <Clock className="h-3.5 w-3.5 mt-1 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <span className="font-medium capitalize">{e.action?.replace(/_/g, " ")}</span>
                    {e.entity && <span className="text-muted-foreground"> · {e.entity}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.actor ?? "system"} · {relative(e.created_at)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground italic">
            {isLoading ? "Loading…" : "No recent activity recorded."}
          </div>
        )}
      </section>
    </>
  );
}
