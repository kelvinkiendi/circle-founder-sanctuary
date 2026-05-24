import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/components/PlaceholderPage";
export const Route = createFileRoute("/products")({
  component: () => (
    <PlaceholderPage eyebrow="Sanctuary · Atelier" title="Product Vault" description="Cuticle oils, shoe horns, and the small luxuries that travel home with our guests." />
  ),
});
