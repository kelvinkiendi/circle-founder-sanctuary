import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Calendar as CalIcon, ChevronDown, ChevronUp } from "lucide-react";

type Range = "today" | "week" | "month";

function rangeDates(r: Range): { from: string; to: string; label: string } {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  if (r === "today") return { from: todayStr, to: todayStr, label: "Today" };
  if (r === "week") {
    const d = new Date(now);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return { from: d.toISOString().slice(0, 10), to: todayStr, label: "This Week" };
  }
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: d.toISOString().slice(0, 10), to: todayStr, label: "This Month" };
}

export function ArtisanEarnings({ staffId }: { staffId: string }) {
  const [range, setRange] = useState<Range>("today");
  const [expanded, setExpanded] = useState(false);
  const r = rangeDates(range);

  const { data: rate } = useQuery({
    queryKey: ["commission-rate", staffId],
    enabled: !!staffId,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_commission_settings")
        .select("commission_percentage, commission_type, fixed_amount_ksh")
        .eq("staff_id", staffId)
        .eq("is_active", true)
        .lte("effective_date", new Date().toISOString().slice(0, 10))
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? { commission_percentage: 0, commission_type: "percentage_of_sale", fixed_amount_ksh: 0 };
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["earnings", staffId, r.from, r.to],
    enabled: !!staffId,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_earnings")
        .select("id, earnings_date, service_name, sale_amount_ksh, commission_percentage, total_commission_ksh")
        .eq("staff_id", staffId)
        .gte("earnings_date", r.from)
        .lte("earnings_date", r.to)
        .order("earnings_date", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const totals = useMemo(() => {
    const sales = rows.reduce((s: number, x: any) => s + Number(x.sale_amount_ksh || 0), 0);
    const commission = rows.reduce((s: number, x: any) => s + Number(x.total_commission_ksh || 0), 0);
    const count = rows.length;
    const avg = count ? Math.round(sales / count) : 0;
    return { sales, commission, count, avg };
  }, [rows]);

  return (
    <section className="bg-white border border-[#d4b896]/60 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <TrendingUp className="h-5 w-5 text-[#5D4037]" />
        <div className="flex-1">
          <h2 className="font-display text-lg text-[#5D4037]">My Earnings</h2>
          <div className="text-[10px] text-[#8b6f47] uppercase tracking-wider">
            Rate: {Number(rate?.commission_percentage ?? 0)}%
            {rate?.commission_type !== "percentage_of_sale" && ` (${rate?.commission_type})`}
          </div>
        </div>
        <button onClick={() => setExpanded((e) => !e)} className="p-1.5 rounded hover:bg-[#5D4037]/5">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 mb-3 text-[10px]">
        {(["today", "week", "month"] as Range[]).map((k) => (
          <button
            key={k}
            onClick={() => setRange(k)}
            className={`uppercase tracking-wider rounded-md py-1.5 transition ${
              range === k ? "bg-[#5D4037] text-[#F5F5DC]" : "bg-[#5D4037]/5 text-[#5D4037]"
            }`}
          >
            {rangeDates(k).label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Sales" value={`KSH ${totals.sales.toLocaleString()}`} />
        <Stat label="Commission" value={`KSH ${totals.commission.toLocaleString()}`} highlight />
        <Stat label="Services" value={String(totals.count)} />
        <Stat label="Avg / service" value={`KSH ${totals.avg.toLocaleString()}`} />
      </div>

      {expanded && (
        <div className="mt-3 border-t border-[#d4b896]/40 pt-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[#8b6f47] mb-2">
            <CalIcon className="h-3 w-3" /> Transactions
          </div>
          {rows.length === 0 ? (
            <div className="text-xs italic text-[#8b6f47] py-4 text-center">No earnings in this range.</div>
          ) : (
            <ul className="space-y-1 max-h-64 overflow-y-auto text-xs">
              {rows.map((row: any) => (
                <li key={row.id} className="flex items-center gap-2 bg-[#F5F5DC]/40 rounded px-2 py-1.5">
                  <span className="font-mono text-[10px] text-[#8b6f47] w-16 shrink-0">{row.earnings_date}</span>
                  <span className="flex-1 truncate">{row.service_name ?? "Service"}</span>
                  <span className="opacity-70">{Number(row.commission_percentage)}%</span>
                  <span className="opacity-70 w-20 text-right">KSH {Number(row.sale_amount_ksh).toLocaleString()}</span>
                  <span className="font-medium text-[#5D4037] w-20 text-right">+{Number(row.total_commission_ksh).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? "bg-[#5D4037] text-[#F5F5DC]" : "bg-[#F5F5DC]/60 text-[#5D4037]"}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="font-display text-lg leading-tight">{value}</div>
    </div>
  );
}
