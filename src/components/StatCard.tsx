import { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: "default" | "gold";
}

export function StatCard({ label, value, hint, icon: Icon, accent = "default" }: Props) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          {label}
        </div>
        <div
          className={`h-9 w-9 rounded-full grid place-items-center ${
            accent === "gold" ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <div className="font-display text-4xl text-foreground">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </div>
    </div>
  );
}
