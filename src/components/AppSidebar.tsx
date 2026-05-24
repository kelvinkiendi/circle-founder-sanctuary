import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Crown,
  CalendarDays,
  Sparkles,
  Gift,
  Package,
  Wine,
  Settings,
  MessageSquare,
  CreditCard,
  Smartphone,
} from "lucide-react";

const items = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "All Clients", url: "/clients", icon: Users },
  { title: "The Circle", url: "/founders", icon: Crown },
  { title: "Appointments", url: "/appointments", icon: CalendarDays },
  { title: "Perks Tracker", url: "/perks", icon: Sparkles },
  { title: "Surprise Moments", url: "/surprises", icon: Gift },
  { title: "Product Vault", url: "/products", icon: Package },
  { title: "Founder Brunch", url: "/brunch", icon: Wine },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageSquare },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => (url === "/" ? path === "/" : path.startsWith(url));

  return (
    <aside className="hidden md:flex flex-col w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen">
      <div className="px-6 py-7 border-b border-sidebar-border">
        <div className="font-display text-2xl tracking-[0.2em] text-sidebar-primary">
          COTERIE
        </div>
        <div className="text-[10px] tracking-[0.35em] mt-1 text-sidebar-foreground/60 uppercase">
          Nail Sanctuary
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1">
        {items.map((item) => {
          const active = isActive(item.url);
          return (
            <Link
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-sidebar-border text-[10px] tracking-[0.25em] uppercase text-sidebar-foreground/50">
        The Circle · 2026
      </div>
    </aside>
  );
}
