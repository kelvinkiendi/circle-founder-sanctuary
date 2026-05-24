import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/brunch")({
  component: () => (
    <PlaceholderPage eyebrow="The Circle · Gathering" title="Founder Brunch" description="Where The Circle gathers — events, RSVPs, and the rituals that bind them." />
  ),
});
