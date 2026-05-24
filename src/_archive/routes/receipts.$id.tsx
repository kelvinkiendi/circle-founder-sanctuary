import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export const Route = createFileRoute("/receipts/$id")({ component: ReceiptPage });

function ReceiptPage() {
  const { id } = Route.useParams();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase
        .from("receipts").select("*").eq("id", id).maybeSingle();
      if (!r) return;
      const { data: p } = await supabase.from("payments").select("*").eq("id", r.payment_id).maybeSingle();
      const { data: c } = await supabase.from("clients").select("full_name, phone, email").eq("id", r.client_id).maybeSingle();
      setData({ r, p, c });
    })();
  }, [id]);

  if (!data) return <div className="p-10 text-center text-muted-foreground">Loading receipt…</div>;
  const { r, p, c } = data;

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-2xl mx-auto bg-card border rounded-lg p-10 shadow-sm print:shadow-none print:border-0">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="font-display text-3xl tracking-[0.2em]">COTERIE</div>
            <div className="text-[10px] tracking-[0.35em] uppercase text-muted-foreground">Nail Sanctuary</div>
          </div>
          <div className="text-right text-xs">
            <div className="uppercase tracking-widest text-muted-foreground">Receipt</div>
            <div className="font-mono">{r.receipt_number}</div>
            <div className="text-muted-foreground">{new Date(r.issued_at).toLocaleString()}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm mb-8">
          <div>
            <div className="text-muted-foreground text-xs uppercase mb-1">Issued to</div>
            <div className="font-medium">{c?.full_name}</div>
            <div>{c?.phone}</div>
            <div className="text-muted-foreground">{c?.email}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs uppercase mb-1">Payment</div>
            <div>M-Pesa · {p?.mpesa_receipt_number ?? "—"}</div>
            <div className="text-muted-foreground">Phone {p?.phone}</div>
          </div>
        </div>

        <div className="border-t border-b py-6 mb-8">
          <div className="flex justify-between items-baseline">
            <div>
              <div className="font-medium">{r.description ?? "COTERIE Service"}</div>
              <div className="text-xs text-muted-foreground capitalize">{p?.payment_type?.replace(/_/g, " ")}</div>
            </div>
            <div className="font-display text-3xl">KSH {Number(r.amount_ksh).toLocaleString()}</div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          Thank you. The Circle · COTERIE Nail Sanctuary · Kilimani, Nairobi
        </div>

        <div className="mt-8 flex justify-center print:hidden">
          <Button onClick={() => window.print()} className="gap-2"><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>
    </div>
  );
}
