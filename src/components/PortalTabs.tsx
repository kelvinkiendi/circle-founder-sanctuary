import { ReactNode, useEffect, useState } from "react";

export type PortalTab = {
  id: string;
  label: string;
  render: () => ReactNode;
};

function readTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search);
  return p.get("tab");
}

export function PortalTabs({ tabs, initial }: { tabs: PortalTab[]; initial?: string }) {
  const fromUrl = readTabFromUrl();
  const valid = (id: string | null) => (id && tabs.some((t) => t.id === id) ? id : null);
  const [active, setActive] = useState(valid(fromUrl) ?? initial ?? tabs[0]?.id);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== active) {
      url.searchParams.set("tab", active);
      window.history.replaceState({}, "", url.toString());
    }
  }, [active]);

  return (
    <div>
      <div className="border-b border-border mb-6 -mx-6 md:-mx-10 px-6 md:px-10 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => {
            const on = t.id === current?.id;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`px-4 py-3 text-xs uppercase tracking-[0.25em] whitespace-nowrap border-b-2 transition-colors ${
                  on
                    ? "border-gold text-gold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <div>{current?.render()}</div>
    </div>
  );
}
