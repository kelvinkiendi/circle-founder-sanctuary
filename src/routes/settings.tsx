import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/settings")({
  component: () => (
    <PlaceholderPage eyebrow="Sanctuary" title="Settings" description="Preferences, staff access, and the quiet workings of the studio." />
  ),
});
