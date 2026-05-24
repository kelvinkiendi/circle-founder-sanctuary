import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole } from "@/lib/session";
import { DashboardContent } from "@/components/Dashboard";
import { Download } from "lucide-react";

export const Route = createFileRoute("/guardian/view")({
  component: () => (
    <RequireRole roles={["guardian","admin"]}>
      <Layout>
        <PageHeader eyebrow="The Guardian · View Only" title="Audit & Reports" description="Read-only access to financial and operational records." />
        <div className="mb-6 flex gap-3">
          <Link to="/payments" className="px-3 py-2 rounded border border-border text-xs uppercase tracking-[0.2em] flex items-center gap-2"><Download className="h-3 w-3"/> Payments Export</Link>
          <Link to="/founders" className="px-3 py-2 rounded border border-border text-xs uppercase tracking-[0.2em]">Founder Records</Link>
          <Link to="/appointments" className="px-3 py-2 rounded border border-border text-xs uppercase tracking-[0.2em]">Appointment Log</Link>
        </div>
        <DashboardContent eyebrow="The Guardian · Snapshot" title="Today, at a glance." />
      </Layout>
    </RequireRole>
  ),
  ssr: false,
});
