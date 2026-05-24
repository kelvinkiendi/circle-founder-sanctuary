import { Bell, Search, ChevronDown, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { PORTAL_PATH, ROLE_LABEL, CAN, type StaffRole } from "@/lib/permissions";

export function TopBar() {
  const { session, logout } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const switchTo = (role: StaffRole) => {
    setOpen(false);
    router.navigate({ to: PORTAL_PATH[role] as any });
  };

  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center px-6 gap-4">
      <div className="md:hidden font-display text-xl tracking-[0.2em] text-primary">COTERIE</div>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input type="search" placeholder="Search…"
          className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring/40" />
      </div>
      <div className="ml-auto flex items-center gap-4">
        {session && CAN.switchPortal(session.role) && (
          <div className="relative">
            <button onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
              Portal <ChevronDown className="h-3 w-3" />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-popover border border-border rounded-md shadow-md py-1 z-50">
                {(["admin","manager","technician","reception","guardian"] as StaffRole[]).map((r) => (
                  <button key={r} onClick={() => switchTo(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent">
                    {ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-foreground/70" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold" />
        </button>
        {session && (
          <div className="flex items-center gap-3 pl-4 border-l border-border">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium">{session.fullName}</div>
              <div className="text-xs text-muted-foreground">{ROLE_LABEL[session.role]}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-sm">
              {session.fullName[0]}
            </div>
            <button onClick={logout} className="p-2 rounded-md hover:bg-accent" title="Sign out">
              <LogOut className="h-4 w-4 text-foreground/70" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
