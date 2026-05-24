import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { DashboardContent } from "@/components/Dashboard";
import { RequireRole } from "@/lib/session";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <RequireRole roles={["admin","manager","guardian"]}>
      <Layout><DashboardContent /></Layout>
    </RequireRole>
  ),
  ssr: false,
});
