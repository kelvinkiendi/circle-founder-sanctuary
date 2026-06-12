import { useRouterState } from "@tanstack/react-router";
import { Users, LayoutDashboard, Smartphone, LogOut, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/session";
import { NAV_BY_ROLE, ROLE_LABEL, type NavKey } from "@/lib/permissions";

const ITEMS: Record<NavKey, { title: string; url: string; icon: any }> = {
  checkin: { title: "Front Desk",    url: "/concierge/desk", icon: Users },
  reports: { title: "Audit & Reports", url: "/guardian/view", icon: LayoutDashboard },
  tech:    { title: "Artisan View",  url: "/artisan/today", icon: Smartphone },
};

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { session, logout } = useSession();
  const isActive = (url: string) => path.startsWith(url);
  const navKeys = session ? NAV_BY_ROLE[session.role] : [];

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen">
      <div className="px-6 py-7 border-b border-sidebar-border">
        <div className="font-display text-2xl tracking-[0.2em] text-sidebar-primary">COTERIE</div>
        <div className="text-[10px] tracking-[0.35em] mt-1 text-sidebar-foreground/60 uppercase">
          {session ? ROLE_LABEL[session.role] : "Nail Sanctuary"}
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {navKeys.map((key) => {
          const item = ITEMS[key];
          const active = isActive(item.url);
          return (
            <a key={key} href={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-primary font-medium"
                       : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </a>
          );
        })}
        {session?.role === "admin" && (
          <a
            href="/admin/partners"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
              isActive("/admin/partners")
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Partners</span>
            {isActive("/admin/partners") && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
          </a>
        )}
      </nav>
      {session && (
        <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
          <div className="px-3 text-xs">
            <div className="font-medium truncate">{session.fullName}</div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-sidebar-foreground/50">
              {ROLE_LABEL[session.role]}
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/60">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
