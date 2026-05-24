import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { DashboardContent } from "@/components/Dashboard";
import { RequireRole } from "@/lib/session";

export const Route = createFileRoute("/manager")({
  component: () => (
    <RequireRole roles={["manager","admin"]}>
      <Layout><DashboardContent eyebrow="The Steward · Operations" title="Operational overview." /></Layout>
    </RequireRole>
  ),
  ssr: false,
});
