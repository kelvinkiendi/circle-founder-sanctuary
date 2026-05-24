import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession, RequireRole } from "@/lib/session";
import { toast } from "sonner";
import {
  Plus, X, Search, Calendar, Clock, MapPin, Gift, Sparkles, Plane,
  Coffee, AlertTriangle, CheckCircle2, ChevronRight, Repeat, LogOut, Lock, User,
  Wallet, Smartphone, Banknote, Trash2,
} from "lucide-react";
import { normalizeKePhone } from "@/lib/phone";
import { initiateMpesaStkPush, recordCashPayment, addPaymentLineItems } from "@/lib/payments.functions";

export const Route = createFileRoute("/artisan/today")({
  component: () => (
    <RequireRole roles={["technician", "admin"]}>
      <ArtisanScheduler />
    </RequireRole>
  ),
  ssr: false,
  head: () => ({
    meta: [
      { title: "Artisan · Today · COTERIE" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
});

// ============ Types ============
type ServiceType =
  | "weekly_refresh" | "full_manicure" | "full_pedicure"
  | "gel_manicure" | "gel_pedicure" | "gel_rescue" | "travel_touchup";

const SERVICE_META: Record<ServiceType, { label: string; minutes: number; priceKsh: number; travelOk?: boolean; capPerDay?: number }> = {
  weekly_refresh: { label: "Weekly Refresh", minutes: 15, priceKsh: 1200 },
  full_manicure:  { label: "Full Manicure",  minutes: 60, priceKsh: 2500 },
  full_pedicure:  { label: "Full Pedicure",  minutes: 75, priceKsh: 3000 },
  gel_manicure:   { label: "Gel Manicure",   minutes: 75, priceKsh: 3500 },
  gel_pedicure:   { label: "Gel Pedicure",   minutes: 90, priceKsh: 4000 },
  gel_rescue:     { label: "Gel Rescue",     minutes: 30, priceKsh: 0, capPerDay: 3 },
  travel_touchup: { label: "Travel Touch-Up",minutes: 45, priceKsh: 2000, travelOk: true, capPerDay: 2 },
};

const BLOCKED_REASONS = ["Lunch Break", "Personal Appointment", "Sick Leave", "Training"] as const;

// ============ Root ============
function ArtisanScheduler() {
  const { session, logout } = useSession();
  const [sheet, setSheet] = useState<"new" | "block" | "walkin-bill" | null>(null);
  const [billingAppt, setBillingAppt] = useState<any | null>(null);
  const [rebookClientId, setRebookClientId] = useState<string | null>(null);
  const [rebookService, setRebookService] = useState<ServiceType | null>(null);
  const techTag = `tech:${session?.staffId ?? ""}`;
  const today = new Date().toISOString().slice(0, 10);

  const qc = useQueryClient();
  const { data: appts } = useQuery({
    queryKey: ["artisan-appts", techTag, today],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_date, scheduled_time, duration_minutes, appointment_type, status, location, notes, created_by, client_id, clients(full_name, phone, client_type)")
        .eq("created_by", techTag)
        .gte("scheduled_date", today)
        .order("scheduled_date").order("scheduled_time");
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const todays = (appts ?? []).filter((a: any) => a.scheduled_date === today);
  const upcoming = (appts ?? []).filter((a: any) => a.scheduled_date > today);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fdfbf7] to-[#f5ecd9] text-[#3a2418]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#5D4037] text-[#F5F5DC] px-4 py-3 flex items-center gap-3 shadow-md">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-70">The Artisan</div>
          <div className="font-display text-lg leading-tight">{session?.fullName ?? "Welcome"}</div>
        </div>
        <button onClick={logout} className="ml-auto p-2 rounded-full bg-white/10 active:bg-white/20" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <main className="px-4 pb-32 pt-4 space-y-6 max-w-xl mx-auto">
        {/* Today's Collection */}
        <CollectionSummary techTag={techTag} today={today} />

        {/* Today */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-2xl">Today's Schedule</h2>
            <span className="text-xs text-[#8b6f47]">{todays.length} booked</span>
          </div>
          <div className="space-y-2">
            {todays.length === 0 && (
              <div className="bg-white/70 border border-[#d4b896]/60 rounded-xl p-6 text-center text-sm text-[#8b6f47] italic">
                No appointments today. Tap + to add one.
              </div>
            )}
            {todays.map((a: any) => (
              <ApptCard
                key={a.id}
                appt={a}
                onRebook={() => { setRebookClientId(a.client_id); setRebookService(a.appointment_type); setSheet("new"); }}
                onBill={() => setBillingAppt(a)}
              />
            ))}
          </div>
        </section>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="font-display text-xl mb-3">Upcoming</h2>
            <div className="space-y-2">
              {upcoming.map((a: any) => <ApptCard key={a.id} appt={a} onRebook={() => {}} compact />)}
            </div>
          </section>
        )}

        <p className="text-[11px] text-[#8b6f47]/70 text-center pt-4">
          Self-bookings are visible to your Manager in real time.
        </p>
      </main>

      {/* Floating actions */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-30 flex-wrap justify-center px-3">
        <button
          onClick={() => setSheet("block")}
          className="bg-[#F5F5DC] text-[#5D4037] border border-[#5D4037]/30 rounded-full px-3 py-2.5 text-xs font-medium shadow-lg active:scale-95 transition flex items-center gap-1.5"
        >
          <Coffee className="h-3.5 w-3.5" /> Block
        </button>
        <button
          onClick={() => setSheet("walkin-bill")}
          className="bg-[#F5F5DC] text-[#5D4037] border border-[#5D4037] rounded-full px-4 py-2.5 text-xs font-medium shadow-lg active:scale-95 transition flex items-center gap-1.5"
        >
          <Wallet className="h-4 w-4" /> Bill Client
        </button>
        <button
          onClick={() => { setRebookClientId(null); setRebookService(null); setSheet("new"); }}
          className="bg-[#5D4037] text-[#F5F5DC] rounded-full px-4 py-2.5 text-xs font-medium shadow-lg active:scale-95 transition flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Booking
        </button>
      </div>

      {/* Sheets */}
      {sheet === "new" && (
        <NewBookingSheet
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); qc.invalidateQueries({ queryKey: ["artisan-appts"] }); }}
          techTag={techTag}
          prefillClientId={rebookClientId}
          prefillService={rebookService}
        />
      )}
      {sheet === "block" && (
        <BlockTimeSheet
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); qc.invalidateQueries({ queryKey: ["artisan-appts"] }); }}
          techTag={techTag}
        />
      )}
      {billingAppt && (
        <BillingSheet
          appt={billingAppt}
          techTag={techTag}
          onClose={() => setBillingAppt(null)}
          onDone={() => { setBillingAppt(null); qc.invalidateQueries({ queryKey: ["artisan-collection"] }); }}
        />
      )}
      {sheet === "walkin-bill" && (
        <BillingSheet
          appt={null}
          techTag={techTag}
          onClose={() => setSheet(null)}
          onDone={() => { setSheet(null); qc.invalidateQueries({ queryKey: ["artisan-collection"] }); }}
        />
      )}
    </div>
  );
}

// ============ Today's Collection Summary ============
function CollectionSummary({ techTag, today }: { techTag: string; today: string }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useQuery({
    queryKey: ["artisan-collection", techTag, today],
    queryFn: async () => {
      const start = `${today}T00:00:00`;
      const end = `${today}T23:59:59`;
      const { data: pays } = await supabase
        .from("payments")
        .select("id, amount_ksh, phone, status, mpesa_receipt_number, description, paid_at, created_by")
        .eq("status", "paid")
        .eq("created_by", techTag)
        .gte("paid_at", start).lte("paid_at", end)
        .order("paid_at", { ascending: false });
      return pays ?? [];
    },
    refetchInterval: 30_000,
  });
  const rows = data ?? [];
  const cash = rows.filter((p: any) => p.phone === "CASH").reduce((s: number, p: any) => s + Number(p.amount_ksh), 0);
  const mpesa = rows.filter((p: any) => p.phone !== "CASH").reduce((s: number, p: any) => s + Number(p.amount_ksh), 0);
  const total = cash + mpesa;

  return (
    <section className="bg-[#5D4037] text-[#F5F5DC] rounded-xl p-4 shadow-md">
      <div className="flex items-center gap-3">
        <Wallet className="h-5 w-5" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Today's Collection</div>
          <div className="font-display text-2xl">KSH {total.toLocaleString()}</div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="text-[11px] uppercase tracking-wider underline">
          {expanded ? "Hide" : "Details"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
        <div className="bg-white/10 rounded p-2 flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> M-Pesa: KSH {mpesa.toLocaleString()}</div>
        <div className="bg-white/10 rounded p-2 flex items-center gap-2"><Banknote className="h-3.5 w-3.5" /> Cash: KSH {cash.toLocaleString()}</div>
      </div>
      {expanded && (
        <ul className="mt-3 space-y-1 text-xs max-h-40 overflow-y-auto">
          {rows.length === 0 && <li className="opacity-60 italic">No collections yet today.</li>}
          {rows.map((p: any) => (
            <li key={p.id} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
              <span className="font-mono opacity-70 text-[10px]">{p.mpesa_receipt_number ?? "—"}</span>
              <span className="flex-1 truncate">{p.description ?? "Service"}</span>
              <span>KSH {Number(p.amount_ksh).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ============ Appointment Card ============
function ApptCard({ appt, onRebook, onBill, compact }: { appt: any; onRebook: () => void; onBill?: () => void; compact?: boolean }) {
  const meta = SERVICE_META[appt.appointment_type as ServiceType];
  const isBlock = String(appt.notes ?? "").startsWith("[BLOCK]");
  return (
    <div className={`bg-white border rounded-xl p-3 shadow-sm ${isBlock ? "border-amber-300 bg-amber-50/60" : "border-[#d4b896]/60"}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-center min-w-[56px]">
          <div className="font-display text-lg leading-none text-[#5D4037]">{appt.scheduled_time?.slice(0, 5)}</div>
          {!compact && <div className="text-[10px] text-[#8b6f47] mt-0.5">{appt.duration_minutes}m</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">
              {isBlock ? String(appt.notes).replace("[BLOCK] ", "") : (appt.clients?.full_name ?? "Guest")}
            </span>
            {appt.clients?.client_type === "founder" && (
              <span className="text-[9px] uppercase tracking-wider bg-[#5D4037] text-[#F5F5DC] px-1.5 py-0.5 rounded">Founder</span>
            )}
          </div>
          <div className="text-xs text-[#8b6f47] mt-0.5 flex items-center gap-2">
            <span>{isBlock ? "Artisan Unavailable" : meta?.label ?? appt.appointment_type}</span>
            {appt.location === "travel" && <span className="flex items-center gap-0.5"><Plane className="h-3 w-3" /> Travel</span>}
          </div>
        </div>
        {!compact && !isBlock && (
          <div className="flex flex-col gap-1">
            <button onClick={onRebook} className="text-[10px] uppercase tracking-wider text-[#5D4037] flex items-center gap-1 px-2 py-1 rounded hover:bg-[#5D4037]/5">
              <Repeat className="h-3 w-3" /> Rebook
            </button>
            {onBill && (
              <button onClick={onBill} className="text-[10px] uppercase tracking-wider text-[#F5F5DC] bg-[#5D4037] flex items-center gap-1 px-2 py-1 rounded">
                <Wallet className="h-3 w-3" /> Bill
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Billing Sheet ============
function BillingSheet({ appt, techTag, onClose, onDone }: { appt: any | null; techTag: string; onClose: () => void; onDone: () => void }) {
  const stk = useServerFn(initiateMpesaStkPush);
  const cash = useServerFn(recordCashPayment);
  const addLines = useServerFn(addPaymentLineItems);

  const [client, setClient] = useState<any | null>(appt?.clients ? { id: appt.client_id, ...appt.clients } : null);
  const [phone, setPhone] = useState<string>(appt?.clients?.phone ?? "");
  const [method, setMethod] = useState<"mpesa" | "cash" | "card">("mpesa");
  const [busy, setBusy] = useState(false);
  type Row = { service_id: string | null; service_name: string; quantity: number; unit_price: number };
  const [rows, setRows] = useState<Row[]>([]);
  const [override, setOverride] = useState<number | null>(null);
  const [desc, setDesc] = useState<string>("");
  const [clientQ, setClientQ] = useState("");

  const { data: services = [] } = useQuery({
    queryKey: ["bill-services"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("services")
        .select("id, name, price_ksh, duration_minutes")
        .eq("status", "active").order("display_order");
      return data ?? [];
    },
  });

  const { data: searchClients = [] } = useQuery({
    queryKey: ["bill-client-search", clientQ],
    queryFn: async () => {
      let qb = supabase.from("clients").select("id, full_name, phone, whatsapp_number, client_type").limit(10);
      if (clientQ.trim()) qb = qb.or(`full_name.ilike.%${clientQ}%,phone.ilike.%${clientQ}%`);
      const { data } = await qb;
      return data ?? [];
    },
    enabled: !client,
  });

  const computedTotal = rows.reduce((s, r) => s + r.unit_price * r.quantity, 0);
  const total = override ?? computedTotal;
  const autoDesc = rows.map((r) => `${r.service_name}${r.quantity > 1 ? ` ×${r.quantity}` : ""}`).join(", ");

  const addRow = (serviceId: string) => {
    const svc = services.find((s: any) => s.id === serviceId);
    if (!svc) return;
    setRows([...rows, { service_id: svc.id, service_name: svc.name, quantity: 1, unit_price: Number(svc.price_ksh) }]);
  };
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!client) { toast.error("Pick a client"); return; }
    if (rows.length === 0) { toast.error("Add at least one service"); return; }
    if (total <= 0) { toast.error("Total must be > 0"); return; }
    const description = (desc || autoDesc).slice(0, 200);
    setBusy(true);
    try {
      if (method === "cash" || method === "card") {
        await cash({
          data: {
            client_id: client.id,
            amount_ksh: total,
            description,
            related_appointment_id: appt?.id ?? null,
            line_items: rows,
            created_by: techTag,
            method,
          },
        });
        toast.success(method === "card" ? "Card payment recorded" : "Cash payment recorded");
        onDone();
        return;
      }
      const ph = normalizeKePhone(phone);
      if (!ph) { toast.error("Invalid phone"); setBusy(false); return; }
      const res = await stk({
        data: {
          client_id: client.id,
          payment_type: "other",
          amount_ksh: total,
          phone: ph,
          description,
          related_appointment_id: appt?.id ?? null,
        },
      });
      try { await addLines({ data: { payment_id: res.payment_id, line_items: rows } }); } catch {}
      toast.success(res.prompt);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <Sheet title="Bill Client" onClose={onClose}>
      <div className="space-y-4">
        {/* Step 1: Client */}
        {!client ? (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Select Client</div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b6f47]" />
              <input value={clientQ} onChange={(e) => setClientQ(e.target.value)} placeholder="Search by name or phone…"
                className="w-full pl-10 pr-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" autoFocus />
            </div>
            <div className="mt-2 max-h-60 overflow-y-auto space-y-1">
              {searchClients.map((c: any) => (
                <button key={c.id} onClick={() => { setClient(c); setPhone(c.phone ?? ""); }}
                  className="w-full text-left p-2.5 bg-white border border-[#d4b896]/40 rounded-lg active:bg-[#F5F5DC] flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.full_name}</div>
                    <div className="text-[11px] text-[#8b6f47]">{c.phone ?? c.whatsapp_number}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#8b6f47]" />
                </button>
              ))}
              {searchClients.length === 0 && <div className="text-xs text-[#8b6f47] italic p-3 text-center">No clients found.</div>}
            </div>
          </div>
        ) : (
          <div className="bg-[#F5F5DC] border border-[#d4b896] rounded-lg p-3">
            <div className="flex items-center gap-2">
              <div className="text-[10px] uppercase tracking-wider text-[#8b6f47]">Client</div>
              {!appt && (
                <button onClick={() => { setClient(null); setPhone(""); }} className="ml-auto text-[10px] underline text-[#5D4037]">Change</button>
              )}
            </div>
            <div className="text-sm font-medium">{client.full_name}</div>
            {method === "mpesa" && (
              <>
                <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] mt-2 block">M-Pesa Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                  className="w-full mt-1 px-3 py-2 border border-[#d4b896] rounded bg-white text-sm" />
              </>
            )}
          </div>
        )}

        {client && (
          <>
            {/* Step 2: Services */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#8b6f47] mb-1.5">Services Performed</div>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white border border-[#d4b896] rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{r.service_name}</div>
                      <div className="text-[10px] text-[#8b6f47]">KSH {r.unit_price.toLocaleString()} × {r.quantity}</div>
                    </div>
                    <input type="number" min={1} value={r.quantity}
                      onChange={(e) => { const n = [...rows]; n[i].quantity = Math.max(1, Number(e.target.value)); setRows(n); }}
                      className="w-14 px-2 py-1 border border-[#d4b896] rounded text-sm text-center" />
                    <input type="number" min={0} value={r.unit_price}
                      onChange={(e) => { const n = [...rows]; n[i].unit_price = Number(e.target.value); setRows(n); }}
                      className="w-20 px-2 py-1 border border-[#d4b896] rounded text-sm text-right" />
                    <button onClick={() => removeRow(i)} className="p-1 text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
              <select onChange={(e) => { if (e.target.value) { addRow(e.target.value); e.target.value = ""; } }}
                className="w-full mt-2 px-3 py-2 border border-[#d4b896] rounded bg-white text-sm">
                <option value="">+ Add a service…</option>
                {services.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name} — KSH {Number(s.price_ksh).toLocaleString()}</option>
                ))}
              </select>
            </div>

            {/* Step 3: Amount + payment */}
            <div className="bg-white border border-[#d4b896] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Computed total</span>
                <span className="font-display text-lg">KSH {computedTotal.toLocaleString()}</span>
              </div>
              <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">Override amount (optional)</label>
              <input type="number" value={override ?? ""} placeholder={String(computedTotal)}
                onChange={(e) => setOverride(e.target.value === "" ? null : Number(e.target.value))}
                className="w-full px-3 py-2 border border-[#d4b896] rounded text-sm" />
              <label className="text-[10px] uppercase tracking-wider text-[#8b6f47] block">Description</label>
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={autoDesc || "Service description"}
                className="w-full px-3 py-2 border border-[#d4b896] rounded text-sm" />
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button onClick={() => setMethod("mpesa")}
                  className={`py-2 rounded text-[11px] border flex items-center justify-center gap-1 ${method === "mpesa" ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                  <Smartphone className="h-3.5 w-3.5" /> M-Pesa
                </button>
                <button onClick={() => setMethod("cash")}
                  className={`py-2 rounded text-[11px] border flex items-center justify-center gap-1 ${method === "cash" ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                  <Banknote className="h-3.5 w-3.5" /> Cash
                </button>
                <button onClick={() => setMethod("card")}
                  className={`py-2 rounded text-[11px] border flex items-center justify-center gap-1 ${method === "card" ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                  <Wallet className="h-3.5 w-3.5" /> Card
                </button>
              </div>
              {method === "card" && (
                <p className="text-[10px] text-[#8b6f47] italic">Swipe on terminal, then tap Record to log the payment.</p>
              )}
            </div>

            <div className="flex items-center justify-between bg-[#F5F5DC] border border-[#d4b896] rounded-lg p-3">
              <span className="text-[11px] uppercase tracking-wider text-[#8b6f47]">To collect</span>
              <span className="font-display text-2xl text-[#5D4037]">KSH {total.toLocaleString()}</span>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Cancel</button>
              <button disabled={busy} onClick={submit}
                className="flex-1 py-3 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? "Processing…"
                  : method === "mpesa" ? <><Smartphone className="h-4 w-4" /> Send STK Push</>
                  : method === "card"  ? <><Wallet className="h-4 w-4" /> Record Card</>
                  : <><Banknote className="h-4 w-4" /> Record Cash</>}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ============ Bottom Sheet wrapper ============
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#fdfbf7] w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom"
      >
        <div className="sticky top-0 bg-[#fdfbf7] border-b border-[#d4b896]/40 px-4 py-3 flex items-center gap-3">
          <div className="font-display text-lg flex-1">{title}</div>
          <button onClick={onClose} className="p-2 -m-2 active:bg-black/5 rounded"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ============ New Booking Sheet ============
function NewBookingSheet({
  onClose, onDone, techTag, prefillClientId, prefillService,
}: {
  onClose: () => void; onDone: () => void; techTag: string;
  prefillClientId: string | null; prefillService: ServiceType | null;
}) {
  const [step, setStep] = useState(1);
  const [client, setClient] = useState<any | null>(null);
  const [service, setService] = useState<ServiceType | null>(prefillService);
  const [customService, setCustomService] = useState<{ id: string; name: string; price_ksh: number; duration_minutes: number } | null>(null);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>("");
  const [duration, setDuration] = useState<number>(0);
  const [location, setLocation] = useState<"studio" | "travel">("studio");
  const [travelAddr, setTravelAddr] = useState("");
  const [notes, setNotes] = useState("");
  const [perkRedeem, setPerkRedeem] = useState<string | null>(null);
  const [notifyClient, setNotifyClient] = useState(true);

  // Prefill client if rebooking
  useEffect(() => {
    if (!prefillClientId) return;
    supabase.from("clients").select("*").eq("id", prefillClientId).maybeSingle().then(({ data }) => {
      if (data) { setClient(data); setStep(2); }
    });
  }, [prefillClientId]);

  // Update duration on service select
  useEffect(() => {
    if (customService) setDuration(customService.duration_minutes);
    else if (service) setDuration(SERVICE_META[service].minutes);
  }, [service, customService]);

  return (
    <Sheet title="New Booking" onClose={onClose}>
      <div className="flex items-center gap-1 mb-4 text-[10px] uppercase tracking-wider">
        {["Client", "Service", "Perks", "Confirm"].map((s, i) => (
          <div key={s} className={`flex-1 text-center py-1 rounded ${step === i + 1 ? "bg-[#5D4037] text-[#F5F5DC]" : "bg-[#d4b896]/30 text-[#8b6f47]"}`}>{s}</div>
        ))}
      </div>

      {step === 1 && <Step1Client onPick={(c) => { setClient(c); setStep(2); }} />}

      {step === 2 && client && (
        <Step2Service
          client={client}
          service={service} setService={setService}
          customService={customService} setCustomService={setCustomService}
          date={date} setDate={setDate}
          time={time} setTime={setTime}
          duration={duration} setDuration={setDuration}
          location={location} setLocation={setLocation}
          travelAddr={travelAddr} setTravelAddr={setTravelAddr}
          notes={notes} setNotes={setNotes}
          techTag={techTag}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && client && service && (
        <Step3Perks
          client={client}
          service={service}
          date={date}
          perkRedeem={perkRedeem}
          setPerkRedeem={setPerkRedeem}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && client && service && time && (
        <Step4Confirm
          client={client} service={service} customService={customService}
          date={date} time={time}
          duration={duration} location={location} travelAddr={travelAddr}
          notes={notes} perkRedeem={perkRedeem} techTag={techTag}
          notifyClient={notifyClient} setNotifyClient={setNotifyClient}
          onBack={() => setStep(3)}
          onDone={onDone}
        />
      )}
    </Sheet>
  );
}

// ============ Step 1: Client ============
function Step1Client({ onPick }: { onPick: (c: any) => void }) {
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newWa, setNewWa] = useState("");
  const qc = useQueryClient();

  const { data: clients } = useQuery({
    queryKey: ["sched-clients", q],
    queryFn: async () => {
      let qb = supabase.from("clients").select("id, full_name, phone, whatsapp_number, client_type, notes").limit(15);
      if (q.trim()) qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%`);
      const { data } = await qb;
      return data ?? [];
    },
  });

  const addNew = async () => {
    const phone = normalizeKePhone(newPhone);
    if (!newName.trim() || !phone) { toast.error("Name and valid phone required"); return; }
    const wa = newWa ? normalizeKePhone(newWa) : phone;
    const { data, error } = await supabase.from("clients").insert({
      full_name: newName.trim(),
      phone,
      whatsapp_number: wa,
      client_type: "regular",
      notes: "[ARTISAN-ADD] Needs profile completion by Reception",
    }).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Client added — flagged for Reception");
    qc.invalidateQueries({ queryKey: ["sched-clients"] });
    onPick(data);
  };

  const askReception = async () => {
    if (!newPhone) { toast.error("Enter phone first"); return; }
    await supabase.from("notifications").insert({
      kind: "registration_request",
      message: `Artisan requests new client registration: ${newPhone}`,
    });
    toast.success("Sent to Reception");
    setAdding(false);
  };

  if (adding) {
    return (
      <div className="space-y-3">
        <h3 className="font-display text-lg">Add New Client</h3>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name"
          className="w-full px-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
        <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (07…)" inputMode="tel"
          className="w-full px-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
        <input value={newWa} onChange={(e) => setNewWa(e.target.value)} placeholder="WhatsApp (optional, same as phone if blank)" inputMode="tel"
          className="w-full px-3 py-2.5 border border-[#d4b896] rounded-lg bg-white text-sm" />
        <p className="text-[11px] text-[#8b6f47]">This creates a basic profile. Reception will complete it later.</p>
        <div className="flex gap-2">
          <button onClick={() => setAdding(false)} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Cancel</button>
          <button onClick={askReception} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm bg-[#F5F5DC]">Ask Reception</button>
          <button onClick={addNew} className="flex-1 py-2.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium">Save</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8b6f47]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone…"
          className="w-full pl-10 pr-3 py-3 border border-[#d4b896] rounded-lg bg-white text-sm" autoFocus />
      </div>
      <div className="space-y-1 max-h-[50vh] overflow-y-auto">
        {(clients ?? []).map((c: any) => (
          <button key={c.id} onClick={() => onPick(c)}
            className="w-full text-left p-3 bg-white border border-[#d4b896]/40 rounded-lg active:bg-[#F5F5DC] flex items-center gap-3">
            <div className="h-9 w-9 bg-[#5D4037] text-[#F5F5DC] rounded-full grid place-items-center text-sm font-display">{c.full_name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-2">
                {c.full_name}
                {c.client_type === "founder" && <span className="text-[9px] uppercase bg-[#5D4037] text-[#F5F5DC] px-1.5 py-0.5 rounded">Founder</span>}
              </div>
              <div className="text-xs text-[#8b6f47]">{c.phone ?? c.whatsapp_number}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#8b6f47]" />
          </button>
        ))}
        {(clients ?? []).length === 0 && q && (
          <div className="text-center py-6 text-sm text-[#8b6f47]">
            <p className="italic mb-3">Client not in system</p>
            <button onClick={() => { setNewPhone(q); setAdding(true); }} className="bg-[#5D4037] text-[#F5F5DC] px-4 py-2 rounded-lg text-xs">Add New Client</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Step 2: Service & Time ============
function Step2Service({
  client, service, setService, customService, setCustomService,
  date, setDate, time, setTime, duration, setDuration,
  location, setLocation, travelAddr, setTravelAddr, notes, setNotes, techTag, onBack, onNext,
}: any) {
  const today = new Date().toISOString().slice(0, 10);

  // Load active services from catalog (admin-managed)
  const { data: catalog = [] } = useQuery({
    queryKey: ["booking-services-catalog"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("services")
        .select("id, name, price_ksh, duration_minutes, category, status")
        .eq("status", "active").order("display_order").order("name");
      return data ?? [];
    },
  });

  // Map a catalog service's category/name to the appointment_type enum
  const mapToEnum = (svc: any): ServiceType => {
    const n = String(svc.name).toLowerCase();
    if (n.includes("weekly") || n.includes("refresh")) return "weekly_refresh";
    if (n.includes("rescue")) return "gel_rescue";
    if (n.includes("travel") || n.includes("touch")) return "travel_touchup";
    if (n.includes("gel") && n.includes("pedi")) return "gel_pedicure";
    if (n.includes("gel")) return "gel_manicure";
    if (n.includes("pedi")) return "full_pedicure";
    return "full_manicure";
  };


  // Existing appts for this tech on this date — to block overlapping slots
  const { data: dayAppts } = useQuery({
    queryKey: ["sched-day", techTag, date],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("scheduled_time, duration_minutes, appointment_type")
        .eq("created_by", techTag).eq("scheduled_date", date)
        .neq("status", "cancelled");
      return data ?? [];
    },
    enabled: !!date,
  });

  const busyRanges = useMemo(() => (dayAppts ?? []).map((a: any) => {
    const [h, m] = a.scheduled_time.split(":").map(Number);
    const start = h * 60 + m;
    return { start, end: start + a.duration_minutes + 15 /* buffer */ };
  }), [dayAppts]);

  const totalMins = useMemo(() => (dayAppts ?? []).reduce((s: number, a: any) => s + a.duration_minutes, 0), [dayAppts]);
  const dailyCap = (dayAppts ?? []).filter((a: any) => a.appointment_type === service).length;

  const slots = useMemo(() => {
    const out: { label: string; value: string; busy: boolean }[] = [];
    for (let mins = 8 * 60; mins < 20 * 60; mins += 15) {
      const h = String(Math.floor(mins / 60)).padStart(2, "0");
      const m = String(mins % 60).padStart(2, "0");
      const slotEnd = mins + duration;
      const busy = busyRanges.some(({ start, end }) => mins < end && slotEnd > start);
      out.push({ label: `${h}:${m}`, value: `${h}:${m}:00`, busy });
    }
    return out;
  }, [busyRanges, duration]);

  const canNext = service && date && time;
  const overEightHours = totalMins + duration > 8 * 60;
  const capExceeded = service && SERVICE_META[service as ServiceType].capPerDay && dailyCap >= SERVICE_META[service as ServiceType].capPerDay!;

  return (
    <div className="space-y-4">
      <div className="bg-[#F5F5DC] border border-[#d4b896] rounded-lg p-3 flex items-center gap-3">
        <User className="h-4 w-4 text-[#5D4037]" />
        <div className="flex-1 text-sm">{client.full_name}</div>
        <span className="text-[10px] uppercase text-[#8b6f47] flex items-center gap-1"><Lock className="h-3 w-3" /> Self</span>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Service</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {catalog.map((svc: any) => {
            const selected = customService?.id === svc.id;
            return (
              <button key={svc.id} onClick={() => { setCustomService({ id: svc.id, name: svc.name, price_ksh: Number(svc.price_ksh), duration_minutes: svc.duration_minutes }); setService(mapToEnum(svc)); }}
                className={`p-2.5 rounded-lg border text-xs text-left ${selected ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                <div className="font-medium">{svc.name}</div>
                <div className={`text-[10px] ${selected ? "opacity-80" : "text-[#8b6f47]"}`}>{svc.duration_minutes}m · KSH {Number(svc.price_ksh).toLocaleString()}</div>
              </button>
            );
          })}
          {catalog.length === 0 && (
            <div className="col-span-2 p-3 text-center text-[11px] text-[#8b6f47] italic border border-dashed border-[#d4b896] rounded-lg">
              No services in catalog yet. Ask the manager to add some.
            </div>
          )}
        </div>
        <div className="mt-2 p-2 rounded bg-[#F5F5DC]/60 text-[10px] text-[#8b6f47] flex items-center gap-1">
          <Lock className="h-3 w-3" /> Surprise / Birthday Sanctuary awarded by COTERIE management only.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Date</label>
          <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full mt-1.5 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Duration (min)</label>
          <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full mt-1.5 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
        </div>
      </div>

      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Time (15-min, +15 buffer)</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5 max-h-48 overflow-y-auto p-2 bg-white border border-[#d4b896] rounded-lg">
          {slots.map((s) => (
            <button key={s.value} disabled={s.busy} onClick={() => setTime(s.value)}
              className={`py-1.5 rounded text-xs ${time === s.value ? "bg-[#5D4037] text-[#F5F5DC]" : s.busy ? "bg-[#d4b896]/30 text-[#8b6f47]/40 line-through" : "hover:bg-[#F5F5DC]"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {service && SERVICE_META[service as ServiceType].travelOk && (
        <div>
          <div className="flex gap-2">
            <button onClick={() => setLocation("studio")} className={`flex-1 py-2 rounded-lg text-xs border ${location === "studio" ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>Studio</button>
            <button onClick={() => setLocation("travel")} className={`flex-1 py-2 rounded-lg text-xs border ${location === "travel" ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}><Plane className="h-3 w-3 inline mr-1" />Travel</button>
          </div>
          {location === "travel" && (
            <>
              <div className="mt-2 flex gap-2">
                <input value={travelAddr} onChange={(e) => setTravelAddr(e.target.value)} placeholder="Client address" className="flex-1 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
                <button
                  type="button"
                  onClick={() => {
                    if (!("geolocation" in navigator)) { toast.error("Geolocation unavailable"); return; }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        const { latitude, longitude } = pos.coords;
                        const link = `https://maps.google.com/?q=${latitude.toFixed(5)},${longitude.toFixed(5)}`;
                        setTravelAddr(travelAddr ? `${travelAddr} (${link})` : link);
                        toast.success("Location pinned");
                      },
                      (err) => toast.error(`GPS: ${err.message}`),
                      { enableHighAccuracy: true, timeout: 8000 },
                    );
                  }}
                  className="px-3 py-2 border border-[#5D4037]/30 rounded-lg text-xs bg-[#F5F5DC] active:scale-95 flex items-center gap-1"
                  title="Use GPS"
                >
                  <MapPin className="h-3.5 w-3.5" /> GPS
                </button>
              </div>
              <p className="text-[10px] text-amber-700 mt-1">Outside Kilimani core may add KSH 500 transport.</p>
            </>
          )}
        </div>
      )}

      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Client notes / special requests"
        className="w-full px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" rows={2} />

      {overEightHours && (
        <div className="p-2 bg-amber-50 border border-amber-300 rounded text-[11px] text-amber-800 flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> You'd exceed 8 hours of bookings today.
        </div>
      )}
      {capExceeded && (
        <div className="p-2 bg-red-50 border border-red-300 rounded text-[11px] text-red-800 flex gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" /> Daily cap reached for {SERVICE_META[service as ServiceType].label}.
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Back</button>
        <button disabled={!canNext || capExceeded} onClick={onNext} className="flex-1 py-2.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium disabled:opacity-40">Continue</button>
      </div>
    </div>
  );
}

// ============ Step 3: Perks ============
function Step3Perks({ client, service, date, perkRedeem, setPerkRedeem, onBack, onNext }: any) {
  const isFounder = client.client_type === "founder";

  const { data: founder } = useQuery({
    queryKey: ["founder-of", client.id],
    queryFn: async () => {
      if (!isFounder) return null;
      const { data } = await supabase.from("founder_circle").select("*, perks_usage(*)").eq("client_id", client.id).maybeSingle();
      return data;
    },
    enabled: isFounder,
  });

  if (!isFounder) {
    return (
      <div className="space-y-4">
        <div className="bg-[#F5F5DC] border border-[#d4b896] rounded-lg p-4 text-sm">
          <Sparkles className="h-4 w-4 inline mr-1 text-[#8b6f47]" />
          Regular client. Standard pricing applies.
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Back</button>
          <button onClick={onNext} className="flex-1 py-2.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium">Continue</button>
        </div>
      </div>
    );
  }

  const perks = (founder?.perks_usage ?? []) as any[];
  const weeklyAvail = perks.find((p) => p.perk_type === "weekly_refresh" && p.status === "available");
  const travelAvail = perks.find((p) => p.perk_type === "travel_touchup" && p.status === "available");
  const weeklyForfeited = perks.some((p) => p.perk_type === "weekly_refresh" && p.status === "forfeited");

  return (
    <div className="space-y-3">
      <div className="bg-[#5D4037] text-[#F5F5DC] rounded-lg p-3 text-xs">
        <Gift className="h-4 w-4 inline mr-1" /> Founder #{founder?.founder_number} · {founder?.status}
      </div>

      {service === "weekly_refresh" && (
        <PerkRow
          label="Weekly Refresh"
          available={!!weeklyAvail}
          reason={weeklyForfeited ? "Forfeited (no-show this week)" : weeklyAvail ? "Available this week — sets price to KSH 0" : "Already used this week"}
          selected={perkRedeem === "weekly_refresh"}
          onToggle={() => setPerkRedeem(perkRedeem === "weekly_refresh" ? null : "weekly_refresh")}
        />
      )}
      {service === "travel_touchup" && (
        <PerkRow
          label="Travel Touch-Up"
          available={!!travelAvail}
          reason={travelAvail ? "Monthly travel touch-up available" : "Already used this month"}
          selected={perkRedeem === "travel_touchup"}
          onToggle={() => setPerkRedeem(perkRedeem === "travel_touchup" ? null : "travel_touchup")}
        />
      )}
      {service === "gel_rescue" && (
        <div className="p-3 bg-amber-50 border border-amber-300 rounded text-xs text-amber-800 flex gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Gel Rescue requires Manager approval. Save as Draft and notify Manager.
        </div>
      )}

      {!["weekly_refresh", "travel_touchup", "gel_rescue"].includes(service) && (
        <div className="p-3 bg-[#F5F5DC] border border-[#d4b896] rounded text-xs text-[#8b6f47]">
          Founder Rate (15% off) auto-applies.
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Back</button>
        <button onClick={onNext} className="flex-1 py-2.5 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium">Continue</button>
      </div>
    </div>
  );
}

function PerkRow({ label, available, reason, selected, onToggle }: any) {
  return (
    <div className={`p-3 rounded-lg border ${selected ? "border-[#5D4037] bg-[#F5F5DC]" : "border-[#d4b896] bg-white"} ${!available && "opacity-60"}`}>
      <div className="flex items-center gap-2">
        <Sparkles className={`h-4 w-4 ${available ? "text-green-600" : "text-[#8b6f47]"}`} />
        <div className="flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-[#8b6f47]">{reason}</div>
        </div>
        {available ? (
          <button onClick={onToggle} className={`text-[10px] uppercase px-2 py-1 rounded ${selected ? "bg-[#5D4037] text-[#F5F5DC]" : "bg-green-600 text-white"}`}>
            {selected ? "Selected" : "Redeem"}
          </button>
        ) : (
          <button className="text-[10px] uppercase px-2 py-1 rounded bg-[#d4b896]/40 text-[#8b6f47]">Contact Mgr</button>
        )}
      </div>
    </div>
  );
}

// ============ Step 4: Confirm ============
function Step4Confirm({
  client, service, date, time, duration, location, travelAddr, notes, perkRedeem,
  techTag, notifyClient, setNotifyClient, onBack, onDone,
}: any) {
  const meta = SERVICE_META[service as ServiceType];
  const isFounder = client.client_type === "founder";
  let price = meta.priceKsh;
  if (perkRedeem === "weekly_refresh") price = 0;
  else if (isFounder) price = Math.round(price * 0.85);
  if (location === "travel" && !travelAddr.toLowerCase().includes("kilimani")) price += 500;

  const save = useMutation({
    mutationFn: async () => {
      const composedNotes = [
        notes || null,
        perkRedeem ? `[PERK:${perkRedeem}]` : null,
        location === "travel" ? `[TRAVEL] ${travelAddr}` : null,
        `[PRICE:${price}]`,
      ].filter(Boolean).join(" ");

      const { data: appt, error } = await supabase.from("appointments").insert({
        client_id: client.id,
        appointment_type: service,
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: duration,
        location,
        notes: composedNotes,
        status: "booked",
        created_by: techTag,
      }).select().single();
      if (error) throw error;

      if (perkRedeem) {
        await supabase.from("perks_usage").update({
          status: "used", used_date: date, related_appointment_id: appt.id,
        }).eq("perk_type", perkRedeem).eq("status", "available")
          .eq("founder_id", (await supabase.from("founder_circle").select("id").eq("client_id", client.id).maybeSingle()).data?.id ?? "");
      }

      if (notifyClient && (client.whatsapp_number || client.phone)) {
        await supabase.from("whatsapp_messages").insert({
          client_id: client.id,
          template_key: "booking_confirmation",
          body: `Hi ${client.full_name}, your ${meta.label} is confirmed for ${date} at ${time.slice(0, 5)} (${location === "travel" ? "travel" : "studio"}). — COTERIE`,
          status: "queued",
          created_by: techTag,
        });
      }

      await supabase.from("activity_log").insert({
        entity: "appointment", entity_id: appt.id, action: "self_booked",
        actor: techTag, metadata: { service, perk: perkRedeem, price },
      });

      return appt;
    },
    onSuccess: () => { toast.success("Booking confirmed"); onDone(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div className="space-y-3">
      <div className="bg-white border border-[#d4b896] rounded-lg p-4 space-y-2 text-sm">
        <Row icon={<User className="h-4 w-4" />} label="Client" value={client.full_name} />
        <Row icon={<Sparkles className="h-4 w-4" />} label="Service" value={meta.label} />
        <Row icon={<Calendar className="h-4 w-4" />} label="When" value={`${date} · ${time.slice(0, 5)}`} />
        <Row icon={<Clock className="h-4 w-4" />} label="Duration" value={`${duration} min`} />
        <Row icon={<MapPin className="h-4 w-4" />} label="Location" value={location === "travel" ? `Travel · ${travelAddr}` : "Studio"} />
        <div className="flex items-center gap-2 pt-2 border-t border-[#d4b896]/40">
          <span className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Price</span>
          <span className="ml-auto font-display text-xl text-[#5D4037]">KSH {price.toLocaleString()}</span>
        </div>
        {perkRedeem && <div className="text-[10px] text-green-700">Perk: {perkRedeem.replace("_", " ")} redeemed</div>}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notifyClient} onChange={(e) => setNotifyClient(e.target.checked)} />
        Send WhatsApp confirmation to client
      </label>

      <div className="flex gap-2 pt-2">
        <button onClick={onBack} className="flex-1 py-2.5 border border-[#5D4037]/30 rounded-lg text-sm">Back</button>
        <button disabled={save.isPending} onClick={() => save.mutate()}
          className="flex-1 py-3 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
          {save.isPending ? "Saving…" : <><CheckCircle2 className="h-4 w-4" /> Save & Notify</>}
        </button>
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#8b6f47]">{icon}</span>
      <span className="text-[11px] uppercase tracking-wider text-[#8b6f47] w-20">{label}</span>
      <span className="flex-1 truncate">{value}</span>
    </div>
  );
}

// ============ Block Time Sheet ============
function BlockTimeSheet({ onClose, onDone, techTag }: { onClose: () => void; onDone: () => void; techTag: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00:00");
  const [duration, setDuration] = useState(60);
  const [reason, setReason] = useState<typeof BLOCKED_REASONS[number]>("Lunch Break");

  const save = useMutation({
    mutationFn: async () => {
      // Use a sentinel client_id: pick any (we technically need a client_id). Use first client or insert a placeholder.
      const { data: anyClient } = await supabase.from("clients").select("id").limit(1).maybeSingle();
      if (!anyClient) throw new Error("System has no client records yet");
      const { error } = await supabase.from("appointments").insert({
        client_id: anyClient.id, // sentinel; the [BLOCK] note overrides display
        appointment_type: "full_manicure",
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: duration,
        status: "booked",
        location: "studio",
        notes: `[BLOCK] ${reason}`,
        created_by: techTag,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Time blocked"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet title="Block Personal Time" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Date</label>
            <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full mt-1.5 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Time</label>
            <input type="time" value={time.slice(0, 5)} onChange={(e) => setTime(`${e.target.value}:00`)}
              className="w-full mt-1.5 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
          </div>
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Duration (min)</label>
          <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
            className="w-full mt-1.5 px-3 py-2 border border-[#d4b896] rounded-lg bg-white text-sm" />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b6f47]">Reason</label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {BLOCKED_REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)}
                className={`p-2 rounded-lg border text-xs ${reason === r ? "bg-[#5D4037] text-[#F5F5DC] border-[#5D4037]" : "bg-white border-[#d4b896]"}`}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-[#8b6f47] italic">Manager will see this block. Override requires admin approval.</p>
        <button disabled={save.isPending} onClick={() => save.mutate()}
          className="w-full py-3 bg-[#5D4037] text-[#F5F5DC] rounded-lg text-sm font-medium disabled:opacity-50">
          {save.isPending ? "Saving…" : "Block Time"}
        </button>
      </div>
    </Sheet>
  );
}
