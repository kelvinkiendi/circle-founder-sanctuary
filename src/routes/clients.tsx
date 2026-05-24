import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/clients")({
  component: () => (
    <PlaceholderPage eyebrow="The Sanctuary · Clients" title="All Clients" description="Every soul who has crossed the threshold of COTERIE." />
  ),
});
