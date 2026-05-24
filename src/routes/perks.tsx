import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/perks")({
  component: () => (
    <PlaceholderPage eyebrow="The Circle · Perks" title="Perks Tracker" description="Weekly refreshes, gel rescues, travel touchups — all in one ledger." />
  ),
});
