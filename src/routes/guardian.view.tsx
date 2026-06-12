import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole, useSession } from "@/lib/session";
import { DashboardContent } from "@/components/Dashboard";
import { PortalTabs, type PortalTab } from "@/components/PortalTabs";
import { PerksAnalyticsPage } from "@/_archive/routes/perks";
import { PaymentsPage } from "@/_archive/routes/payments";
import { PartnerAuditSnapshot } from "@/components/PartnerAuditSnapshot";
import { AuditExportPanel } from "@/components/AuditExportPanel";

export const Route = createFileRoute("/guardian/view")({
  component: () => (
    <RequireRole roles={["guardian", "admin", "manager", "partner"]}>
      <Layout><GuardianShell /></Layout>
    </RequireRole>
  ),
  ssr: false,
});

function GuardianShell() {
  const { session } = useSession();
  const isPartner = session?.role === "partner";
  const [forceTab, setForceTab] = useState<string | undefined>(undefined);

  const tabs = useMemo<PortalTab[]>(() => {
    if (isPartner) {
      // Partner: read-only audit-first experience. No perks-mutation surfaces,
      // no payment-action surfaces; everything is presentation only.
      return [
        {
          id: "snapshot",
          label: "Snapshot",
          render: () => <PartnerAuditSnapshot onOpenAudit={() => setForceTab("audit")} />,
        },
        { id: "audit", label: "Audit Reports", render: () => <AuditExportPanel /> },
        { id: "payments", label: "Financial Audit", render: () => <PaymentsPage readOnly /> },
      ];
    }
    // Guardian / admin / manager keep the existing view.
    return [
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
      { id: "audit", label: "Audit Reports", render: () => <AuditExportPanel /> },
      { id: "perks", label: "Perks Analytics", render: () => <PerksAnalyticsPage /> },
      { id: "payments", label: "Financial Audit", render: () => <PaymentsPage readOnly /> },
    ];
  }, [isPartner]);

  return (
    <>
      <PageHeader
        eyebrow={isPartner ? "The Partner · View Only" : "The Guardian · View Only"}
        title="Audit & Reports"
        description="Read-only access to financial and operational records."
      />
      <PortalTabs key={forceTab ?? "default"} tabs={tabs} initial={forceTab} />
    </>
  );
}
