import { createFileRoute } from "@tanstack/react-router";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole } from "@/lib/session";
import { DashboardContent } from "@/components/Dashboard";
import { PortalTabs, type PortalTab } from "@/components/PortalTabs";
import { PerksAnalyticsPage } from "@/_archive/routes/perks";
import { PaymentsPage } from "@/_archive/routes/payments";

export const Route = createFileRoute("/guardian/view")({
  component: () => (
    <RequireRole roles={["guardian", "admin", "manager"]}>
      <Layout><GuardianShell /></Layout>
    </RequireRole>
  ),
  ssr: false,
});

function GuardianShell() {
  const tabs: PortalTab[] = [
    {
      id: "snapshot",
      label: "Snapshot",
      render: () => (
        <DashboardContent
          eyebrow="The Guardian · Snapshot"
          title="Today, at a glance."
        />
      ),
    },
    { id: "perks", label: "Perks Analytics", render: () => <PerksAnalyticsPage /> },
    { id: "payments", label: "Financial Audit", render: () => <PaymentsPage readOnly /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="The Guardian · View Only"
        title="Audit & Reports"
        description="Read-only access to financial and operational records."
      />
      <PortalTabs tabs={tabs} />
    </>
  );
}
