import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole, useSession } from "@/lib/session";
import { PortalTabs, type PortalTab } from "@/components/PortalTabs";
import { CAN, apptSource, APPT_SOURCE_LABEL, APPT_SOURCE_CLASS } from "@/lib/permissions";
import { Search, UserPlus, Calendar, CreditCard } from "lucide-react";
import { useState } from "react";

// Lifted feature sections
import { Registry } from "@/_archive/routes/registry";
import { AppointmentsPage } from "@/_archive/routes/appointments";
import { FoundersPage } from "@/_archive/routes/founders";
import { PerksAnalyticsPage } from "@/_archive/routes/perks";
import { SurprisesPage } from "@/_archive/routes/surprises";
import { ProductVaultPage } from "@/_archive/routes/products";
import { BrunchPage } from "@/_archive/routes/brunch";
import { PaymentsPage } from "@/_archive/routes/payments";
import { WhatsAppHub } from "@/_archive/routes/whatsapp";
import { SettingsPage } from "@/_archive/routes/settings";
import { ServicesPage } from "@/_archive/routes/services";

export const Route = createFileRoute("/concierge/desk")({
  component: () => (
    <RequireRole roles={["reception", "admin", "manager"]}>
      <Layout><DeskShell /></Layout>
    </RequireRole>
  ),
  ssr: false,
});

function DeskShell() {
  const { session } = useSession();
  const role = session?.role ?? "reception";

  const tabs = useMemo<PortalTab[]>(() => {
    const all: (PortalTab | null)[] = [
      { id: "desk", label: "Front Desk", render: () => <FrontDesk /> },
      { id: "registry", label: "Clients", render: () => <Registry /> },
      { id: "appointments", label: "Appointments", render: () => <AppointmentsPage /> },
      { id: "founders", label: "The Circle", render: () => <FoundersPage /> },
      { id: "perks", label: "Perks", render: () => <PerksAnalyticsPage /> },
      CAN.awardSurprise(role)
        ? { id: "surprises", label: "Surprises", render: () => <SurprisesPage /> }
        : null,
      { id: "products", label: "Products", render: () => <ProductVaultPage /> },
      { id: "brunch", label: "Brunch", render: () => <BrunchPage /> },
      { id: "payments", label: "Payments", render: () => <PaymentsPage /> },
      { id: "whatsapp", label: "WhatsApp", render: () => <WhatsAppHub /> },
      CAN.changeSettings(role)
        ? { id: "services", label: "Services", render: () => <ServicesPage /> }
        : null,
      CAN.changeSettings(role)
        ? { id: "settings", label: "Settings", render: () => <SettingsPage /> }
        : null,
    ];
    return all.filter(Boolean) as PortalTab[];
  }, [role]);

  return (
    <>
      <PageHeader
        eyebrow="The Concierge"
        title="Welcome guests to the sanctuary."
        description="Search, book, check in, and manage The Circle."
      />
      <PortalTabs tabs={tabs} />
    </>
  );
}

function FrontDesk() {
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const { data: clients } = useQuery({
    queryKey: ["concierge-clients", q],
    queryFn: async () => {
      let qb = supabase
        .from("clients")
        .select("id, full_name, phone, whatsapp_number, client_type")
        .limit(20);
      if (q.trim())
        qb = qb.or(
          `full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%`,
        );
      const { data } = await qb;
      return data ?? [];
    },
  });

  const { data: appts } = useQuery({
    queryKey: ["concierge-today"],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(
          "id, scheduled_time, appointment_type, status, created_by, clients(full_name)",
        )
        .eq("scheduled_date", today)
        .order("scheduled_time");
      return data ?? [];
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <section className="lg:col-span-2 bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, WhatsApp…"
            className="flex-1 bg-transparent text-sm outline-none border-b border-border py-2"
          />
          <span className="text-xs uppercase tracking-[0.2em] flex items-center gap-1 text-muted-foreground">
            <UserPlus className="h-3 w-3" /> New
          </span>
        </div>
        <ul className="divide-y divide-border">
          {clients?.map((c: any) => (
            <li key={c.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.full_name}</div>
                <div className="text-xs text-muted-foreground">
                  {c.phone ?? c.whatsapp_number ?? "—"} · {c.client_type}
                </div>
              </div>
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Book
              </span>
            </li>
          ))}
          {!clients?.length && (
            <li className="py-8 text-center text-sm text-muted-foreground italic">
              No clients match.
            </li>
          )}
        </ul>
      </section>

      <section className="bg-card border border-border rounded-lg p-6">
        <h2 className="font-display text-xl mb-4">Today</h2>
        <ul className="divide-y divide-border text-sm">
          {appts?.map((a: any) => {
            const src = apptSource(a.created_by);
            return (
              <li key={a.id} className="py-2.5 flex items-center gap-3">
                <span className="text-primary w-12">{a.scheduled_time?.slice(0, 5)}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{a.clients?.full_name ?? "Guest"}</div>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] uppercase tracking-widest border ${APPT_SOURCE_CLASS[src]}`}>
                    {APPT_SOURCE_LABEL[src]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground capitalize">{a.status}</span>
              </li>
            );
          })}
          {!appts?.length && (
            <li className="py-6 text-center text-xs text-muted-foreground italic">
              No appointments today.
            </li>
          )}
        </ul>
        <div className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <CreditCard className="h-3 w-3" /> Collect Payment
        </div>
      </section>
    </div>
  );
}
