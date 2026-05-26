import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, Crown, CalendarDays, Sparkles, Clock, MapPin } from "lucide-react";
import { PageHeader } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { getDashboardStatsFn } from "@/lib/portal.functions";
import { useSession } from "@/lib/session";

export function DashboardContent({ eyebrow = "The Sanctuary · Today", title = "Good morning." }: { eyebrow?: string; title?: string }) {
  const { session } = useSession();
  const fetchStats = useServerFn(getDashboardStatsFn);
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => fetchStats({ data: { sessionId: session!.sessionId } }),
  });

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description="A quiet snapshot of The Circle and the day's rituals at COTERIE." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        <StatCard label="Total Clients" value={stats?.clientsCount ?? "—"} hint="Across the entire sanctuary" icon={Users} />
        <StatCard label="Active Founders" value={`${stats?.foundersCount ?? 0} / 25`} hint="Seats in The Circle" icon={Crown} accent="gold" />
        <StatCard label="Today's Appointments" value={stats?.todayAppointments.length ?? 0} hint="Scheduled rituals today" icon={CalendarDays} />
        <StatCard label="Weekly Refreshes" value={stats?.weeklyRefreshCount ?? 0} hint="Used this week by founders" icon={Sparkles} accent="gold" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-2xl">Today's Rituals</h2>
          </div>
          {stats?.todayAppointments.length ? (
            <ul className="divide-y divide-border">
              {stats.todayAppointments.map((a: any) => (
                <li key={a.id} className="py-3 flex items-center gap-4">
                  <div className="text-sm font-medium w-16 text-primary">{a.scheduled_time?.slice(0, 5)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.clients?.full_name ?? "Guest"}</div>
                    <div className="text-xs text-muted-foreground capitalize">{a.appointment_type?.replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                    {a.location === "travel" ? <MapPin className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {a.location}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground italic">No rituals scheduled today.</div>
          )}
        </section>
        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display text-2xl mb-5">Coming Up</h2>
          {stats?.upcoming.length ? (
            <ul className="divide-y divide-border">
              {stats.upcoming.map((a: any) => (
                <li key={a.id} className="py-3 flex items-center gap-4">
                  <div className="w-14 text-center">
                    <div className="text-xs uppercase text-muted-foreground">
                      {new Date(a.scheduled_date).toLocaleDateString(undefined, { month: "short" })}
                    </div>
                    <div className="font-display text-xl text-primary leading-none">
                      {new Date(a.scheduled_date).getDate()}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.clients?.full_name ?? "Guest"}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {a.appointment_type?.replace(/_/g, " ")} · {a.scheduled_time?.slice(0, 5)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground italic">No upcoming appointments.</div>
          )}
        </section>
      </div>
    </>
  );
}
