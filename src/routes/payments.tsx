import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Layout, PageHeader } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Download, RefreshCw, Send, CheckCircle2, XCircle, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  computePaymentAmount,
  initiateMpesaStkPush,
  updatePaymentStatus,
  retryPayment,
  getPaymentSummary,
  getOutstandingInstallments,
  runSuspensionSweep,
} from "@/lib/payments.functions";

export const Route = createFileRoute("/payments")({ component: PaymentsPage });

type PaymentRow = {
  id: string;
  client_id: string;
  founder_id: string | null;
  payment_type: string;
  amount_ksh: number;
  phone: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
  mpesa_receipt_number: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  enrollment_full: "Enrollment (Full)",
  enrollment_installment_1: "Installment 1",
  enrollment_installment_2: "Installment 2",
  travel_transport: "Travel Transport",
  full_service_founder: "Full Service (Founder)",
  product_purchase: "Product Purchase",
  emergency_service: "Emergency",
  other: "Other",
};

function statusVariant(s: string) {
  if (s === "paid") return "default";
  if (s === "failed" || s === "cancelled") return "destructive";
  return "secondary";
}

function PaymentsPage() {
  const fetchSummary = useServerFn(getPaymentSummary);
  const fetchOutstanding = useServerFn(getOutstandingInstallments);
  const computeAmt = useServerFn(computePaymentAmount);
  const stkPush = useServerFn(initiateMpesaStkPush);
  const updateStatus = useServerFn(updatePaymentStatus);
  const retry = useServerFn(retryPayment);
  const sweep = useServerFn(runSuspensionSweep);

  const [summary, setSummary] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [founders, setFounders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Request payment form
  const [form, setForm] = useState({
    client_id: "",
    founder_id: "",
    payment_type: "enrollment_full",
    base_amount: 0,
    outside_area: false,
    apply_founder_rate: true,
    phone: "",
    description: "",
  });
  const [computed, setComputed] = useState(0);

  async function loadAll() {
    setLoading(true);
    const [s, o, c, f] = await Promise.all([
      fetchSummary(),
      fetchOutstanding(),
      supabase.from("clients").select("id, full_name, phone").order("full_name"),
      supabase.from("founder_circle").select("id, founder_number, client_id, clients(full_name, phone)").order("founder_number"),
    ]);
    setSummary(s); setOutstanding(o);
    setClients(c.data || []); setFounders(f.data || []);
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  // Recompute amount when relevant fields change
  useEffect(() => {
    computeAmt({ data: {
      payment_type: form.payment_type as any,
      base_amount: form.base_amount,
      outside_area: form.outside_area,
      apply_founder_rate: form.apply_founder_rate,
    }}).then((r) => setComputed(r.amount));
  }, [form.payment_type, form.base_amount, form.outside_area, form.apply_founder_rate]);

  function onFounderChange(id: string) {
    const f = founders.find((x) => x.id === id);
    setForm((p) => ({
      ...p,
      founder_id: id,
      client_id: f?.client_id ?? p.client_id,
      phone: f?.clients?.phone ?? p.phone,
    }));
  }
  function onClientChange(id: string) {
    const c = clients.find((x) => x.id === id);
    setForm((p) => ({ ...p, client_id: id, phone: c?.phone ?? p.phone }));
  }

  async function sendStk() {
    if (!form.client_id || !form.phone || computed <= 0) {
      toast.error("Client, phone, and amount > 0 required");
      return;
    }
    const res = await stkPush({ data: {
      client_id: form.client_id,
      founder_id: form.founder_id || null,
      payment_type: form.payment_type as any,
      amount_ksh: computed,
      phone: form.phone,
      description: form.description || TYPE_LABEL[form.payment_type],
    }});
    toast.success(res.prompt);
    loadAll();
  }

  async function markPaid(id: string) {
    await updateStatus({ data: { payment_id: id, status: "paid" } });
    toast.success("Marked paid — receipt generated");
    loadAll();
  }
  async function markFailed(id: string) {
    await updateStatus({ data: { payment_id: id, status: "failed", failure_reason: "Manual" } });
    toast("Marked failed");
    loadAll();
  }
  async function retryOne(id: string) {
    const r = await retry({ data: { payment_id: id } });
    toast.success(`New STK push: ${r.checkout_request_id}`);
    loadAll();
  }

  function exportCsv() {
    const rows = (summary?.recent || []) as PaymentRow[];
    const header = ["Date", "Client", "Type", "Amount KSH", "Status", "M-Pesa Receipt", "Description"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const client = clients.find((c) => c.id === r.client_id)?.full_name ?? r.client_id;
      lines.push([
        new Date(r.created_at).toISOString(),
        `"${client}"`,
        TYPE_LABEL[r.payment_type] ?? r.payment_type,
        r.amount_ksh,
        r.status,
        r.mpesa_receipt_number ?? "",
        `"${(r.description ?? "").replace(/"/g, '""')}"`,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `coterie-payments-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const recent: PaymentRow[] = summary?.recent ?? [];

  return (
    <Layout title="Payments" subtitle="M-Pesa STK Push · Receipts · Reconciliation">
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm">Today</CardTitle></CardHeader>
          <CardContent className="text-2xl font-display">KSH {(summary?.today_total ?? 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Last 7 days</CardTitle></CardHeader>
          <CardContent className="text-2xl font-display">KSH {(summary?.week_total ?? 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">This month</CardTitle></CardHeader>
          <CardContent className="text-2xl font-display">KSH {(summary?.month_total ?? 0).toLocaleString()}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Pending / Failed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-display">{summary?.pending_count ?? 0} / {summary?.failed_count ?? 0}</CardContent></Card>
      </div>

      <Tabs defaultValue="request" className="mt-6">
        <TabsList>
          <TabsTrigger value="request">Request Payment</TabsTrigger>
          <TabsTrigger value="recent">Recent Transactions</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding Installments</TabsTrigger>
        </TabsList>

        <TabsContent value="request">
          <Card>
            <CardHeader><CardTitle>New M-Pesa STK Push</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Founder (optional)</Label>
                <Select value={form.founder_id} onValueChange={onFounderChange}>
                  <SelectTrigger><SelectValue placeholder="Select founder…" /></SelectTrigger>
                  <SelectContent>
                    {founders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>#{f.founder_number} · {f.clients?.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={onClientChange}>
                  <SelectTrigger><SelectValue placeholder="Select client…" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Payment type</Label>
                <Select value={form.payment_type} onValueChange={(v) => setForm({ ...form, payment_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Phone (M-Pesa)</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="2547XXXXXXXX" />
              </div>
              {(form.payment_type === "full_service_founder" || form.payment_type === "product_purchase" || form.payment_type === "emergency_service" || form.payment_type === "other") && (
                <div>
                  <Label>Base amount (KSH)</Label>
                  <Input type="number" value={form.base_amount} onChange={(e) => setForm({ ...form, base_amount: Number(e.target.value) })} />
                </div>
              )}
              {form.payment_type === "full_service_founder" && (
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.apply_founder_rate} onCheckedChange={(v) => setForm({ ...form, apply_founder_rate: v })} />
                  <Label>Apply 15% Founder Rate</Label>
                </div>
              )}
              {form.payment_type === "travel_transport" && (
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.outside_area} onCheckedChange={(v) => setForm({ ...form, outside_area: v })} />
                  <Label>Outside Kilimani core (+500 KSH)</Label>
                </div>
              )}
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional note shown on receipt" />
              </div>
              <div className="md:col-span-2 flex items-center justify-between border-t pt-4">
                <div className="text-sm">
                  Auto-calculated amount
                  <div className="text-3xl font-display">KSH {computed.toLocaleString()}</div>
                </div>
                <Button onClick={sendStk} className="gap-2"><Send className="h-4 w-4" /> Send STK Push</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recent">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Payments</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadAll}><RefreshCw className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Client</TableHead><TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Receipt</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {recent.map((r) => {
                    const cname = clients.find((c) => c.id === r.client_id)?.full_name ?? "—";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                        <TableCell>{cname}</TableCell>
                        <TableCell>{TYPE_LABEL[r.payment_type]}</TableCell>
                        <TableCell>KSH {Number(r.amount_ksh).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={statusVariant(r.status) as any}>{r.status}</Badge></TableCell>
                        <TableCell className="text-xs">{r.mpesa_receipt_number ?? "—"}</TableCell>
                        <TableCell className="flex gap-1 justify-end">
                          {r.status === "pending" && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => markPaid(r.id)}><CheckCircle2 className="h-4 w-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => markFailed(r.id)}><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                          {(r.status === "failed" || r.status === "cancelled") && (
                            <Button size="sm" variant="ghost" onClick={() => retryOne(r.id)}><RefreshCw className="h-4 w-4" /></Button>
                          )}
                          {r.status === "paid" && <FileText className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {recent.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No payments yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Outstanding Installments</CardTitle>
              <Button size="sm" variant="outline" onClick={async () => {
                const r = await sweep(); toast.success(`Suspension sweep complete — ${r.suspended} updated`); loadAll();
              }}>Run 45-day suspension sweep</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Founder #</TableHead><TableHead>Client</TableHead><TableHead>Owed</TableHead>
                  <TableHead>Due</TableHead><TableHead>Overdue</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {outstanding.map((o) => (
                    <TableRow key={o.founder_id}>
                      <TableCell>#{o.founder_number}</TableCell>
                      <TableCell>{o.client_name}</TableCell>
                      <TableCell>KSH {o.amount_owed.toLocaleString()}</TableCell>
                      <TableCell>{o.due_date}</TableCell>
                      <TableCell>{o.days_overdue > 0 ? <Badge variant="destructive">{o.days_overdue}d</Badge> : "—"}</TableCell>
                      <TableCell><Badge>{o.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {outstanding.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">All caught up</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
