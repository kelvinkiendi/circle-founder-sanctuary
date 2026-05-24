import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 md:p-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between mb-8 gap-6 flex-wrap">
      <div>
        {eyebrow && (
          <div className="text-[10px] tracking-[0.35em] uppercase text-gold mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-4xl text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
