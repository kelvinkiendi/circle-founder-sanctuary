import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/appointments")({
  component: () => (
    <PlaceholderPage eyebrow="Sanctuary · Rituals" title="Appointments" description="Every ritual on the books — studio and travel alike." />
  ),
});
