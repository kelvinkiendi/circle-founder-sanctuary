import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Crown, CalendarDays, Sparkles, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function startOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const weekStart = startOfWeek().toISOString().slice(0, 10);

      const [clients, founders, todayAppts, weeklyRefresh, upcoming] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase
          .from("founder_circle")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("appointments")
          .select("id, scheduled_time, appointment_type, location, status, clients(full_name)")
          .eq("scheduled_date", today)
          .order("scheduled_time"),
        supabase
          .from("perks_usage")
          .select("*", { count: "exact", head: true })
          .eq("perk_type", "weekly_refresh")
          .eq("status", "used")
          .gte("used_date", weekStart),
        supabase
          .from("appointments")
          .select("id, scheduled_date, scheduled_time, appointment_type, clients(full_name)")
          .gte("scheduled_date", today)
          .order("scheduled_date")
          .limit(5),
      ]);

      return {
        clientsCount: clients.count ?? 0,
        foundersCount: founders.count ?? 0,
        todayAppointments: todayAppts.data ?? [],
        weeklyRefreshCount: weeklyRefresh.count ?? 0,
        upcoming: upcoming.data ?? [],
      };
    },
  });

  return (
    <Layout>
      <PageHeader
        eyebrow="The Sanctuary · Today"
        title="Good morning, Atelier."
        description="A quiet snapshot of The Circle and the day's rituals at COTERIE."
      />

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
            <span className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </span>
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
            <EmptyState text="No rituals scheduled today. A quiet day in the sanctuary." />
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
            <EmptyState text="No upcoming appointments on the books." />
          )}
        </section>
      </div>
    </Layout>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-12 text-center text-sm text-muted-foreground italic">{text}</div>;
}
