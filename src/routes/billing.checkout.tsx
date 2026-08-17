import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingCart,
  Smartphone, Banknote, CreditCard, CheckCircle2,
} from "lucide-react";
import { useSession, RequireRole } from "@/lib/session";
import { normalizeKePhone } from "@/lib/phone";
import { initiateMpesaStkPush, recordCashPayment, addPaymentLineItems } from "@/lib/payments.functions";
import { searchClientsFn, getActiveServicesFn, getClientByIdFn } from "@/lib/portal.functions";

type Search = { clientId?: string; apptId?: string };

export const Route = createFileRoute("/billing/checkout")({
  component: () => (
    <RequireRole roles={["admin", "manager", "reception"]}>
      <CheckoutPage />
    </RequireRole>
  ),
  ssr: false,
  validateSearch: (s: Record<string, unknown>): Search => ({
    clientId: typeof s['clientId'] === "string" ? s['clientId'] : undefined,
    apptId: typeof s['apptId'] === "string" ? s['apptId'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Checkout · Billing · COTERIE" },
      { name: "description", content: "Add services to the trolley, total the bill and collect by M-Pesa, cash or card." },
      { property: "og:title", content: "Checkout · Billing · COTERIE" },
      { property: "og:description", content: "Service trolley checkout for COTERIE The Circle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
});

type Row = { service_id: string | null; service_name: string; quantity: number; unit_price: number };

function CheckoutPage() {
  const { session } = useSession();
  const router = useRouter();
  const { clientId, apptId } = Route.useSearch();

  const searchClients = useServerFn(searchClientsFn);
  const fetchServices = useServerFn(getActiveServicesFn);
  const fetchClient = useServerFn(getClientByIdFn);
  const stk = useServerFn(initiateMpesaStkPush);
  const cash = useServerFn(recordCashPayment);
  const addLines = useServerFn(addPaymentLineItems);

  const [client, setClient] = useState<any | null>(null);
  const [clientQ, setClientQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [serviceQ, setServiceQ] = useState("");
  const [method, setMethod] = useState<"mpesa" | "cash" | "card">("mpesa");
  const [phone, setPhone] = useState("");
  const [cardRef, setCardRef] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useQuery({
    queryKey: ["checkout-prefill", clientId, session?.sessionId],
    enabled: !!clientId && !!session?.sessionId && !client,
    queryFn: async () => {
      const c = await fetchClient({ data: { sessionId: session!.sessionId, id: clientId! } });
      if (c) { setClient(c); setPhone((c as any).phone ?? ""); }
      return c ?? null;
    },
  });

  const { data: results = [] } = useQuery({
    queryKey: ["checkout-client-search", clientQ, session?.sessionId],
    enabled: !client && !!session?.sessionId,
    queryFn: () => searchClients({ data: { sessionId: session!.sessionId, q: clientQ, fields: "mini", limit: 10 } }),
  });

  const { data: services = [] } = useQuery({
    queryKey: ["checkout-services", session?.sessionId],
    enabled: !!session?.sessionId,
    queryFn: () => fetchServices({ data: { sessionId: session!.sessionId } }),
  });

  const filteredServices = useMemo(() => {
    const q = serviceQ.trim().toLowerCase();
    return (services as any[]).filter((s) => !q || String(s.name).toLowerCase().includes(q));
  }, [services, serviceQ]);

  const subtotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
  const total = Math.max(0, subtotal - (discount || 0));
  const autoDesc = rows.map((r) => `${r.service_name}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`).join(", ");

  const addService = (svc: any) => {
    setRows((prev) => {
      const i = prev.findIndex((r) => r.service_id === svc.id);
      if (i >= 0) {
        const n = [...prev];
        n[i] = { ...n[i]!, quantity: n[i]!.quantity + 1 };
        return n;
      }
      return [...prev, { service_id: svc.id, service_name: svc.name, quantity: 1, unit_price: Number(svc.price_ksh) }];
    });
  };
  const bump = (i: number, d: number) =>
    setRows((prev) => prev.flatMap((r, idx) => {
      if (idx !== i) return [r];
      const q = r.quantity + d;
      return q <= 0 ? [] : [{ ...r, quantity: q }];
    }));
  const setPrice = (i: number, v: number) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, unit_price: Math.max(0, v) } : r)));

  const submit = async () => {
    if (!session) { toast.error("Please sign in again"); return; }
    if (!client) { toast.error("Pick a client"); return; }
    if (rows.length === 0) { toast.error("Trolley is empty"); return; }
    if (total <= 0) { toast.error("Total must be greater than 0"); return; }
    if (method === "card" && !cardRef.trim()) { toast.error("Enter the card reference number"); return; }
    const description = (desc || autoDesc).slice(0, 200);
    setBusy(true);
    try {
      if (method === "cash" || method === "card") {
        await cash({
          data: {
            sessionId: session.sessionId,
            client_id: client.id,
            amount_ksh: total,
            description,
            related_appointment_id: apptId ?? null,
            line_items: rows,
            created_by: `staff:${session.staffId}`,
            method,
            reference: method === "card" ? cardRef.trim() : null,
          },
        });
        setDone(method === "card" ? `Card payment recorded · Ref ${cardRef.trim()}` : "Cash payment recorded");
        return;
      }
      const ph = normalizeKePhone(phone);
      if (!ph) { toast.error("Enter a valid M-Pesa number"); setBusy(false); return; }
      const res = await stk({
        data: {
          sessionId: session.sessionId,
          client_id: client.id,
          payment_type: "other",
          amount_ksh: total,
          phone: ph,
          description,
          related_appointment_id: apptId ?? null,
        },
      });
      try { await addLines({ data: { sessionId: session.sessionId, payment_id: res.payment_id, line_items: rows } }); } catch { /* non-fatal */ }
      setDone(res.prompt ?? "STK push sent to the client");
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fdfbf7] to-[#f5ecd9] text-[#3a2418] flex items-center justify-center p-6">
        <div className="bg-white border border-[#d4b896] rounded-2xl p-8 max-w-sm w-full text-center space-y-4 shadow-lg">
          <CheckCircle2 className="h-12 w-12 text-[#5D4037] mx-auto" />
          <div className="font-display text-2xl">KSH {total.toLocaleString()}</div>
          <p className="text-sm text-[#8b6f47]">{done}</p>
          <div className="flex gap-2 pt-2">
            <button onClick={() => { setDone(null); setRows([]); setClient(null); setCardRef(""); setDiscount(0); setDesc(""); }}
              className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">New bill</button>
            <button onClick={() => router.history.back()} className="flex-1 py-2.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdfbf7] to-[#f5ecd9] text-[#3a2418] pb-40">
      <header className="sticky top-0 z-20 bg-[#5D4037] text-[#F5F5DC] px-4 py-3 flex items-center gap-3 shadow-md">
        <button onClick={() => router.history.back()} className="p-1 -m-1"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <h1 className="font-display text-lg leading-none">Checkout</h1>
          <p className="text-[11px] opacity-70">Trolley billing</p>
        </div>
        <ShoppingCart className="h-5 w-5" />
        {rows.length > 0 && (
          <span className="bg-[#F5F5DC] text-[#5D4037] text-[10px] font-bold rounded-full px-2 py-0.5">{rows.length}</span>
        )}
      </header>

      <main className="p-4 space-y-5 max-w-2xl mx-auto">
        {/* Client */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Client</h2>
          {!client ? (
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b6f47]" />
                <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="Search by name or phone…"
                  className="w-full pl-10 pr-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
              </div>
              <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
                {(results as any[]).map((c) => (
                  <button key={c.id} onClick={() => { setClient(c); setPhone(c.phone ?? c.whatsapp_number ?? ""); }}
                    className="w-full text-left p-2.5 bg-white border border-[#d4b896]/40 rounded-lg active:bg-[#F5F5DC]">
                    <div className="text-sm font-medium truncate">{c.full_name}</div>
                    <div className="text-[11px] text-[#8b6f47]">{c.phone ?? c.whatsapp_number}</div>
                  </button>
                ))}
                {(results as any[]).length === 0 && <p className="text-xs text-[#8b6f47] italic p-3 text-center">No clients found.</p>}
              </div>
            </div>
          ) : (
            <div className="bg-[#F5F5DC] border border-[#d4b896] rounded-lg p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{client.full_name}</div>
                <div className="text-[11px] text-[#8b6f47]">{client.phone ?? client.whatsapp_number ?? "—"}</div>
              </div>
              <button onClick={() => { setClient(null); setPhone(""); }} className="text-[10px] underline text-[#5D4037]">Change</button>
            </div>
          )}
        </section>

        {/* Service catalogue */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Services</h2>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b6f47]" />
            <input value={serviceQ} onChange={(e) => setServiceQ(e.target.value)} placeholder="Search services…"
              className="w-full pl-10 pr-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {filteredServices.map((s: any) => (
              <button key={s.id} onClick={() => addService(s)}
                className="text-left bg-white border border-[#d4b896] rounded-lg p-3 active:bg-[#F5F5DC] transition">
                <div className="text-sm font-medium leading-tight">{s.name}</div>
                <div className="text-[11px] text-[#8b6f47] mt-1">KSH {Number(s.price_ksh).toLocaleString()}</div>
                <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#5D4037]">
                  <Plus className="h-3 w-3" /> Add
                </div>
              </button>
            ))}
            {filteredServices.length === 0 && <p className="text-xs text-[#8b6f47] italic col-span-2 p-3">No services available.</p>}
          </div>
        </section>

        {/* Trolley */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Trolley</h2>
          {rows.length === 0 ? (
            <div className="bg-white/70 border border-[#d4b896]/60 rounded-xl p-6 text-center text-sm text-[#8b6f47] italic">
              Trolley is empty — tap a service to add it.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={`${r.service_id}-${i}`} className="flex items-center gap-2 bg-white border border-[#d4b896] rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{r.service_name}</div>
                    <div className="text-[10px] text-[#8b6f47]">KSH {(r.unit_price * r.quantity).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => bump(i, -1)} className="p-1.5 border border-[#d4b896] rounded"><Minus className="h-3 w-3" /></button>
                    <span className="w-6 text-center text-sm">{r.quantity}</span>
                    <button onClick={() => bump(i, 1)} className="p-1.5 border border-[#d4b896] rounded"><Plus className="h-3 w-3" /></button>
                  </div>
                  <input type="number" min={0} value={r.unit_price} onChange={(e) => setPrice(i, Number(e.target.value))}
                    className="w-20 px-2 py-1 border border-[#d4b896] rounded text-sm text-right" />
                  <button onClick={() => setRows(rows.filter((_, idx) => idx !== i))} className="p-1 text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="bg-white border border-[#d4b896] rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#8b6f47]">Subtotal</span><span>KSH {subtotal.toLocaleString()}</span>
                </div>
                <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">Discount (KSH)</label>
                <input type="number" min={0} value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  placeholder="0" className="w-full px-3 py-2 border border-[#d4b896] rounded text-sm" />
                <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">Note on receipt</label>
                <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={autoDesc || "Service description"}
                  className="w-full px-3 py-2 border border-[#d4b896] rounded text-sm" />
              </div>
            </div>
          )}
        </section>

        {/* Payment */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Payment method</h2>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["mpesa", "M-Pesa", Smartphone],
              ["cash", "Cash", Banknote],
              ["card", "Card", CreditCard],
            ] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setMethod(key)}
                className={`py-2.5 rounded-lg text-[11px] border flex items-center justify-center gap-1 ${
                  method === key ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {method === "mpesa" && (
            <div className="mt-2">
              <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">M-Pesa number to prompt</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XX XXX XXX"
                className="w-full mt-1 px-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
            </div>
          )}
          {method === "card" && (
            <div className="mt-2">
              <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">Card reference number</label>
              <input value={cardRef} onChange={(e) => setCardRef(e.target.value)} placeholder="Terminal / approval reference"
                className="w-full mt-1 px-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
            </div>
          )}
          {method === "cash" && (
            <p className="text-[11px] text-[#8b6f47] italic mt-2">Collect cash, then record the payment to generate a receipt.</p>
          )}
        </section>
      </main>

      {/* Sticky total bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-[#fdfbf7] border-t border-[#d4b896] p-4 space-y-2">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Total to collect</span>
          <span className="font-display text-2xl text-[#5D4037]">KSH {total.toLocaleString()}</span>
        </div>
        <button disabled={busy || rows.length === 0 || !client} onClick={submit}
          className="max-w-2xl mx-auto w-full py-3.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? "Processing…"
            : method === "mpesa" ? <><Smartphone className="h-4 w-4" /> Send STK Push</>
            : method === "card" ? <><CreditCard className="h-4 w-4" /> Record Card Payment</>
            : <><Banknote className="h-4 w-4" /> Record Cash Payment</>}
        </button>
      </div>
    </div>
  );
}
