import { Layout, PageHeader } from "./Layout";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Layout>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="bg-card border border-border rounded-lg p-16 text-center">
        <div className="font-display text-2xl text-muted-foreground mb-2">
          Coming to the Sanctuary
        </div>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          This view is being prepared. The data layer is connected and ready —
          tell us what you'd like to see first.
        </p>
      </div>
    </Layout>
  );
}
