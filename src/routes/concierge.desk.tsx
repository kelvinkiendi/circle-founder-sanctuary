import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole } from "@/lib/session";
import { Search, UserPlus, Calendar, CreditCard } from "lucide-react";

export const Route = createFileRoute("/concierge/desk")({
  component: () => (
    <RequireRole roles={["reception","admin"]}>
      <Layout><Desk /></Layout>
    </RequireRole>
  ),
  ssr: false,
});

function Desk() {
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0,10);

  const { data: clients } = useQuery({
    queryKey: ["concierge-clients", q],
    queryFn: async () => {
      let qb = supabase.from("clients").select("id, full_name, phone, whatsapp_number, client_type").limit(20);
      if (q.trim()) qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%`);
      const { data } = await qb;
      return data ?? [];
    },
  });

  const { data: appts } = useQuery({
    queryKey: ["concierge-today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_time, appointment_type, status, clients(full_name)")
        .eq("scheduled_date", today)
        .order("scheduled_time");
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader eyebrow="The Concierge · Front Desk" title="Welcome guests to the sanctuary." description="Search, book, and check in clients. Reschedules go to a manager." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search by name, phone, WhatsApp…"
              className="flex-1 bg-transparent text-sm outline-none border-b border-border py-2" />
            <Link to="/clients" className="text-xs uppercase tracking-[0.2em] flex items-center gap-1 text-primary"><UserPlus className="h-3 w-3"/> New</Link>
          </div>
          <ul className="divide-y divide-border">
            {clients?.map((c: any) => (
              <li key={c.id} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone ?? c.whatsapp_number ?? "—"} · {c.client_type}</div>
                </div>
                <Link to="/appointments" className="text-xs uppercase tracking-[0.2em] text-primary flex items-center gap-1"><Calendar className="h-3 w-3"/> Book</Link>
              </li>
            ))}
            {!clients?.length && <li className="py-8 text-center text-sm text-muted-foreground italic">No clients match.</li>}
          </ul>
        </section>

        <section className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display text-xl mb-4">Today · read-only</h2>
          <ul className="divide-y divide-border text-sm">
            {appts?.map((a:any) => (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <span className="text-primary w-12">{a.scheduled_time?.slice(0,5)}</span>
                <span className="flex-1 truncate">{a.clients?.full_name ?? "Guest"}</span>
                <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
              </li>
            ))}
            {!appts?.length && <li className="py-6 text-center text-xs text-muted-foreground italic">No appointments today.</li>}
          </ul>
          <Link to="/payments" className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-primary">
            <CreditCard className="h-3 w-3" /> Collect Payment
          </Link>
        </section>
      </div>
    </>
  );
}
