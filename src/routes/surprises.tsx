import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/surprises")({
  component: () => (
    <PlaceholderPage eyebrow="The Circle · Delight" title="Surprise Moments" description="A quiet log of the unexpected gestures gifted to founders." />
  ),
});
