import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, Crown, CalendarDays, Sparkles, Gift, Package,
  Wine, Settings, MessageSquare, CreditCard, Smartphone, LogOut, UserPlus,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { NAV_BY_ROLE, ROLE_LABEL, type NavKey } from "@/lib/permissions";

const ITEMS: Record<NavKey, { title: string; url: string; icon: any }> = {
  dashboard:   { title: "Dashboard",        url: "/dashboard",    icon: LayoutDashboard },
  registry:    { title: "The Registry",     url: "/registry",     icon: UserPlus },
  clients:     { title: "All Clients",      url: "/clients",      icon: Users },
  founders:    { title: "The Circle",       url: "/founders",     icon: Crown },
  appointments:{ title: "Appointments",     url: "/appointments", icon: CalendarDays },
  perks:       { title: "Perks Tracker",    url: "/perks",        icon: Sparkles },
  surprises:   { title: "Surprise Moments", url: "/surprises",    icon: Gift },
  products:    { title: "Product Vault",    url: "/products",     icon: Package },
  brunch:      { title: "Founder Brunch",   url: "/brunch",       icon: Wine },
  payments:    { title: "Payments",         url: "/payments",     icon: CreditCard },
  tech:        { title: "Technician View",  url: "/tech",         icon: Smartphone },
  whatsapp:    { title: "WhatsApp",         url: "/whatsapp",     icon: MessageSquare },
  settings:    { title: "Settings",         url: "/settings",     icon: Settings },
  reports:     { title: "Reports",          url: "/guardian/view",icon: LayoutDashboard },
  checkin:     { title: "Front Desk",       url: "/concierge/desk", icon: Users },
  exports:     { title: "Export Center",    url: "/guardian/view",icon: CreditCard },
};

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { session, logout } = useSession();
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

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
            <Link key={key} to={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-primary font-medium"
                       : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}>
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
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
