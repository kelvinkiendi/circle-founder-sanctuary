import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole } from "@/lib/session";
import { DashboardContent } from "@/components/Dashboard";

export const Route = createFileRoute("/guardian/view")({
  component: () => (
    <RequireRole roles={["guardian","admin"]}>
      <Layout>
        <PageHeader eyebrow="The Guardian · View Only" title="Audit & Reports" description="Read-only access to financial and operational records." />
        <DashboardContent eyebrow="The Guardian · Snapshot" title="Today, at a glance." />
      </Layout>
    </RequireRole>
  ),
  ssr: false,
});
