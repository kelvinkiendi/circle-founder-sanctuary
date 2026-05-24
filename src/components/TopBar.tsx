import { Bell, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-16 border-b border-border bg-card/60 backdrop-blur flex items-center px-6 gap-4">
      <div className="md:hidden font-display text-xl tracking-[0.2em] text-primary">
        COTERIE
      </div>
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search clients, founders, appointments..."
          className="w-full pl-10 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>
      <div className="ml-auto flex items-center gap-4">
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="h-5 w-5 text-foreground/70" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gold" />
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium">Studio Atelier</div>
            <div className="text-xs text-muted-foreground">Sanctuary Host</div>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-sm">
            C
          </div>
        </div>
      </div>
    </header>
  );
}
