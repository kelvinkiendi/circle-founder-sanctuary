import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { RequireRole } from "@/lib/session";

export const Route = createFileRoute("/artisan/today")({
  component: () => (
    <RequireRole roles={["technician","admin"]}>
      <ArtisanRedirect />
    </RequireRole>
  ),
  ssr: false,
});

function ArtisanRedirect() {
  const router = useRouter();
  useEffect(() => { router.navigate({ to: "/tech" }); }, [router]);
  return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Opening your schedule…</div>;
}
