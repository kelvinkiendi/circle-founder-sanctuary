import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, Smartphone, Banknote, CreditCard, CheckCircle2, Crown, Loader2, ShieldAlert,
} from "lucide-react";
import { Layout, PageHeader } from "@/components/Layout";
import { RequireRole, useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  searchPayableClientsFn, listUnpaidServicesFn, receptionStartMpesaFn,
  receptionRecordCashFn, receptionStartCardFn, confirmCardPaymentFn,
  getPaymentStatusFn, listReceptionPaymentsFn,
} from "@/lib/reception-payments.functions";

export const Route = createFileRoute("/reception/payments")({
  component: () => (
    <RequireRole roles={["reception", "admin", "manager"]}>
      <Layout><ReceptionPayments /></Layout>
    </RequireRole>
  ),
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reception Payments · COTERIE" },
      { name: "description", content: "Charge regular salon clients by M-Pesa, cash or bank card and issue receipts." },
      { property: "og:title", content: "Reception Payments · COTERIE" },
      { property: "og:description", content: "Charge regular salon clients by M-Pesa, cash or bank card and issue receipts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type ClientRow = {
  id: string; full_name: string; phone: string | null; email: string | null;
  client_type: string; status: string; founder_number: number | null; is_active_founder: boolean;
};
type Unpaid = {
  appointment_id: string; date: string; time: string; service_name: string;
  amount_ksh: number; technician: string | null; status: string;
};

function ReceptionPayments() {
  const { session } = useSession();
  const sessionId = session?.sessionId ?? "";
  const qc = useQueryClient();

  const searchClients = useServerFn(searchPayableClientsFn);
  const listUnpaid = useServerFn(listUnpaidServicesFn);
  const startMpesa = useServerFn(receptionStartMpesaFn);
  const recordCash = useServerFn(receptionRecordCashFn);
  const startCard = useServerFn(receptionStartCardFn);
  const confirmCard = useServerFn(confirmCardPaymentFn);
  const pollStatus = useServerFn(getPaymentStatusFn);

  const [q, setQ] = useState("");
  const [client, setClient] = useState<ClientRow | null>(null);
  const [service, setService] = useState<Unpaid | null>(null);
  const [method, setMethod] = useState<"mpesa" | "cash" | "card">("mpesa");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(0);
  const [received, setReceived] = useState(0);
  const [cardRef, setCardRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [pendingKind, setPendingKind] = useState<"mpesa" | "card" | null>(null);
  const [pendingStatus, setPendingStatus] = useState<string>("pending");
  const [receipt, setReceipt] = useState<any>(null);

  const { data: clients } = useQuery({
    queryKey: ["rp-clients", sessionId, q],
    enabled: !!sessionId,
    queryFn: () => searchClients({ data: { sessionId, q, limit: 10 } }) as Promise<ClientRow[]>,
  });

  const { data: unpaid } = useQuery({
    queryKey: ["rp-unpaid", sessionId, client?.id],
    enabled: !!sessionId && !!client && !client.is_active_founder,
    queryFn: () => listUnpaid({ data: { sessionId, clientId: client!.id } }) as Promise<Unpaid[]>,
  });

  // Poll M-Pesa status — the callback is the source of truth, never the browser.
  useEffect(() => {
    if (!pendingPaymentId || pendingKind !== "mpesa") return;
    const t = setInterval(async () => {
      const r = await pollStatus({ data: { sessionId, payment_id: pendingPaymentId } });
      setPendingStatus(r.payment.status);
      if (r.payment.status !== "pending") {
        clearInterval(t);
        if (r.payment.status === "paid") {
          setReceipt({ ...r.receipt, payment: r.payment, method: "M-Pesa" });
          toast.success("Payment confirmed");
          qc.invalidateQueries({ queryKey: ["rp-unpaid"] });
          qc.invalidateQueries({ queryKey: ["rp-history"] });
        } else {
          toast.error(`Payment ${r.payment.status}`);
        }
        setPendingPaymentId(null);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [pendingPaymentId, pendingKind, sessionId]);

  function pick(c: ClientRow) {
    setClient(c); setService(null); setReceipt(null); setPendingPaymentId(null);
    setPhone(c.phone ?? ""); setAmount(0); setReceived(0);
  }
  function pickService(s: Unpaid) {
    setService(s); setAmount(s.amount_ksh); setReceived(s.amount_ksh); setReceipt(null);
  }

  const founderBlocked = !!client?.is_active_founder;

  async function process() {
    if (!client || founderBlocked) return;
    if (amount <= 0) return toast.error("Enter an amount greater than zero");
    setBusy(true);
    try {
      const base = {
        sessionId,
        client_id: client.id,
        appointment_id: service?.appointment_id ?? null,
        amount_ksh: amount,
        description: service?.service_name ?? "Salon service",
      };
      if (method === "mpesa") {
        const r = await startMpesa({ data: { ...base, phone } });
        setPendingPaymentId(r.payment_id); setPendingKind("mpesa"); setPendingStatus("pending");
        toast.success(r.message);
      } else if (method === "cash") {
        if (received < amount) throw new Error("Amount received is less than amount due");
        const r = await recordCash({ data: { ...base, amount_received: received } });
        setReceipt({ ...r.receipt, payment: r.payment, method: "Cash", change: r.change, cashier: r.cashier });
        toast.success("Cash payment recorded");
        qc.invalidateQueries({ queryKey: ["rp-unpaid"] });
        qc.invalidateQueries({ queryKey: ["rp-history"] });
      } else {
        const r = await startCard({ data: base });
        setPendingPaymentId(r.payment_id); setPendingKind("card"); setPendingStatus("processing");
        toast.message(r.message);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Payment failed");
    } finally {
      setBusy(false);
    }
  }

  async function finishCard(outcome: "successful" | "failed") {
    if (!pendingPaymentId) return;
    setBusy(true);
    try {
      const r = await confirmCard({
        data: { sessionId, payment_id: pendingPaymentId, outcome, terminal_reference: cardRef || undefined },
      });
      if (outcome === "successful") {
        setReceipt({ ...r.receipt, payment: r.payment, method: "Bank Card" });
        toast.success("Card payment confirmed");
      } else {
        toast.error("Card payment failed");
      }
      setPendingPaymentId(null); setCardRef("");
      qc.invalidateQueries({ queryKey: ["rp-unpaid"] });
      qc.invalidateQueries({ queryKey: ["rp-history"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not confirm card payment");
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader
        eyebrow="Reception"
        title="Payments"
        description="Charge regular salon clients — M-Pesa, cash or bank card. Founder Circle billing is handled separately."
      />

      <Tabs defaultValue="charge">
        <TabsList>
          <TabsTrigger value="charge">Charge Client</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="charge" className="grid gap-6 lg:grid-cols-3 mt-4">
          {/* Search */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-sm">1 · Search Client</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or email" />
              </div>
              <ul className="divide-y divide-border">
                {clients?.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => pick(c)}
                      className={`w-full text-left py-2.5 px-1 rounded ${client?.id === c.id ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                      <div className="text-sm font-medium flex items-center gap-2">
                        {c.full_name}
                        {c.is_active_founder
                          ? <Badge variant="destructive" className="gap-1"><Crown className="h-3 w-3" /> Founder Circle</Badge>
                          : <Badge variant="secondary">Regular</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.phone ?? "—"} · {c.email ?? "no email"} · {c.status}
                      </div>
                    </button>
                  </li>
                ))}
                {!clients?.length && <li className="py-6 text-center text-xs text-muted-foreground italic">No clients match.</li>}
              </ul>
            </CardContent>
          </Card>

          {/* Services */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-sm">2 · Unpaid Service</CardTitle></CardHeader>
            <CardContent>
              {!client && <p className="text-xs text-muted-foreground italic">Select a client first.</p>}
              {founderBlocked && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
                  <ShieldAlert className="h-4 w-4 mt-0.5 text-destructive" />
                  <span>This is a Founder Circle client. Founder services cannot be billed through Reception Payments.</span>
                </div>
              )}
              {client && !founderBlocked && (
                <ul className="divide-y divide-border">
                  {unpaid?.map((s) => (
                    <li key={s.appointment_id}>
                      <button onClick={() => pickService(s)}
                        className={`w-full text-left py-2.5 px-1 rounded ${service?.appointment_id === s.appointment_id ? "bg-secondary" : "hover:bg-secondary/50"}`}>
                        <div className="text-sm font-medium capitalize">{s.service_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {s.technician ? ` · ${s.technician}` : ""} · KES {s.amount_ksh.toLocaleString()}
                        </div>
                      </button>
                    </li>
                  ))}
                  {!unpaid?.length && (
                    <li className="py-4 text-xs text-muted-foreground italic">
                      No unpaid appointments — you can still charge an ad-hoc amount below.
                    </li>
                  )}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-sm">3 · Take Payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <fieldset disabled={!client || founderBlocked} className="space-y-4 disabled:opacity-50">
                <div>
                  <Label>Amount due (KES)</Label>
                  <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([["mpesa", "M-Pesa", Smartphone], ["cash", "Cash", Banknote], ["card", "Bank Card", CreditCard]] as const).map(([k, label, Icon]) => (
                    <button key={k} type="button" onClick={() => setMethod(k)}
                      className={`border rounded-md py-2 text-xs flex flex-col items-center gap-1 ${method === k ? "border-primary bg-primary/10" : "border-border"}`}>
                      <Icon className="h-4 w-4" />{label}
                    </button>
                  ))}
                </div>

                {method === "mpesa" && (
                  <div>
                    <Label>M-Pesa phone</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="2547XXXXXXXX" />
                  </div>
                )}
                {method === "cash" && (
                  <div className="space-y-2">
                    <Label>Amount received</Label>
                    <Input type="number" value={received} onChange={(e) => setReceived(Number(e.target.value))} />
                    <div className="text-sm">Change: <strong>KES {Math.max(0, received - amount).toLocaleString()}</strong></div>
                  </div>
                )}
                {method === "card" && (
                  <p className="text-xs text-muted-foreground">
                    Please insert, tap or swipe the client's card on the card terminal. No card details are entered or stored here.
                  </p>
                )}

                <Button className="w-full" onClick={process} disabled={busy || !!pendingPaymentId}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {method === "mpesa" ? "Send STK Push" : method === "cash" ? "Confirm Cash Payment" : "Start Card Payment"}
                </Button>
              </fieldset>

              {pendingPaymentId && pendingKind === "mpesa" && (
                <div className="rounded-md border border-border p-3 text-sm">
                  <div className="font-medium flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> STK Push sent</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please check your phone and enter your M-Pesa PIN. Status: {pendingStatus}
                  </p>
                </div>
              )}

              {pendingPaymentId && pendingKind === "card" && (
                <div className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Processing at terminal — tap, insert or swipe.</p>
                  <Label>Terminal / provider reference</Label>
                  <Input value={cardRef} onChange={(e) => setCardRef(e.target.value)} placeholder="e.g. 004512" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => finishCard("successful")} disabled={busy || !cardRef.trim()}>Terminal approved</Button>
                    <Button size="sm" variant="outline" onClick={() => finishCard("failed")} disabled={busy}>Declined</Button>
                  </div>
                </div>
              )}

              {receipt && (
                <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm space-y-1">
                  <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-primary" /> Payment complete</div>
                  <div>Client: {client?.full_name}</div>
                  <div>Service: {service?.service_name ?? receipt.payment?.description}</div>
                  {service?.technician && <div>Nail Tech: {service.technician}</div>}
                  <div>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
                  <div>Amount: KES {Number(receipt.payment?.amount_ksh ?? amount).toLocaleString()}</div>
                  <div>Method: {receipt.method}</div>
                  {receipt.change != null && <div>Change: KES {Number(receipt.change).toLocaleString()}</div>}
                  <div>Reference: {receipt.payment?.mpesa_receipt_number ?? "—"}</div>
                  <div>Receipt No: {receipt.receipt_number}</div>
                  <div>Status: Paid</div>
                  <div>Served by: {receipt.cashier ?? session?.fullName}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <PaymentHistory sessionId={sessionId} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function PaymentHistory({ sessionId }: { sessionId: string }) {
  const list = useServerFn(listReceptionPaymentsFn);
  const [status, setStatus] = useState<"all" | "pending" | "paid" | "failed" | "cancelled">("all");
  const [method, setMethod] = useState<"all" | "mpesa" | "cash" | "card">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows } = useQuery({
    queryKey: ["rp-history", sessionId, status, method, q, from, to],
    enabled: !!sessionId,
    queryFn: () => list({ data: { sessionId, status, method, q, from: from || undefined, to: to || undefined } }) as Promise<any[]>,
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Regular-client payments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Client name" value={q} onChange={(e) => setQ(e.target.value)} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <select className="border border-border bg-background rounded-md text-sm px-2 h-9"
            value={method} onChange={(e) => setMethod(e.target.value as any)}>
            <option value="all">All methods</option><option value="mpesa">M-Pesa</option>
            <option value="cash">Cash</option><option value="card">Bank Card</option>
          </select>
          <select className="border border-border bg-background rounded-md text-sm px-2 h-9"
            value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">All statuses</option><option value="pending">Pending</option>
            <option value="paid">Paid</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option>
          </select>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Description</TableHead>
            <TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Reference</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs">{new Date(p.created_at).toLocaleString()}</TableCell>
                <TableCell>{p.clients?.full_name ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.description ?? "—"}</TableCell>
                <TableCell className="capitalize">{p.method}</TableCell>
                <TableCell>KES {Number(p.amount_ksh).toLocaleString()}</TableCell>
                <TableCell><Badge variant={p.status === "paid" ? "default" : p.status === "pending" ? "secondary" : "destructive"}>{p.status}</Badge></TableCell>
                <TableCell className="text-xs">{p.mpesa_receipt_number ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!rows?.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
