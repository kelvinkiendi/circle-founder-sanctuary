import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/founders")({
  component: () => (
    <PlaceholderPage eyebrow="The Circle · Founders" title="The Circle" description="The twenty-five who shape the sanctuary." />
  ),
});
