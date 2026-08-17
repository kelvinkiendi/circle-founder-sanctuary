import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError, type StaffSessionRow } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });

/** Only reception + admin/manager may operate the regular-client payment desk. */
const DESK_ROLES = ["reception", "admin", "manager"] as const;

function sanitize(q: string) {
  return q.replace(/[^\w\s@.\-+]/g, "").slice(0, 80).trim();
}

function normalizeMsisdn(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

function genReceiptNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COT-${stamp}-${tail}`;
}

/**
 * Founder protection — backend enforced. Reception Payments is only for
 * regular (non-Founder) clients; Founder Circle billing is a separate workflow.
 */
async function assertNotFounder(clientId: string) {
  const { data: founder } = await supabaseAdmin
    .from("founder_circle")
    .select("id, status, founder_number")
    .eq("client_id", clientId)
    .maybeSingle();
  if (founder && founder.status === "active") {
    throw new Error(
      "This is a Founder Circle client. Founder services cannot be billed through Reception Payments.",
    );
  }
  return founder ?? null;
}

async function actorTag(staff: StaffSessionRow) {
  return `${staff.role}:${staff.staff_id}`;
}

// ---------- Client search ----------

export const searchPayableClientsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    q: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(25).default(10),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...DESK_ROLES]);
    let qb = supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, email, whatsapp_number, client_type, status")
      .order("full_name")
      .limit(data.limit);
    const q = sanitize(data.q ?? "");
    if (q) {
      qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,whatsapp_number.ilike.%${q}%`);
    }
    const { data: clients, error } = await qb;
    if (error) dbError(error, "searchPayableClients");
    const ids = (clients ?? []).map((c) => c.id);
    if (!ids.length) return [];
    const { data: founders } = await supabaseAdmin
      .from("founder_circle").select("client_id, founder_number, status").in("client_id", ids);
    const byClient = new Map((founders ?? []).map((f) => [f.client_id, f]));
    return (clients ?? []).map((c) => {
      const f = byClient.get(c.id);
      return {
        ...c,
        founder_number: f?.founder_number ?? null,
        is_active_founder: f?.status === "active",
      };
    });
  });

// ---------- Unpaid services ----------

export const listUnpaidServicesFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...DESK_ROLES]);
    await assertNotFounder(data.clientId);

    const { data: appts, error } = await supabaseAdmin
      .from("appointments")
      .select("id, scheduled_date, scheduled_time, appointment_type, service_description, service_id, status, created_by")
      .eq("client_id", data.clientId)
      .in("status", ["booked", "completed"])
      .order("scheduled_date", { ascending: false })
      .limit(30);
    if (error) dbError(error, "listUnpaidServices");
    const rows = appts ?? [];
    if (!rows.length) return [];

    const apptIds = rows.map((a) => a.id);
    const [{ data: paid }, { data: services }, { data: staff }] = await Promise.all([
      supabaseAdmin.from("payments")
        .select("related_appointment_id, status")
        .in("related_appointment_id", apptIds)
        .in("status", ["paid", "pending"]),
      supabaseAdmin.from("services").select("id, name, price_ksh"),
      supabaseAdmin.from("staff").select("id, full_name"),
    ]);
    const settled = new Set((paid ?? []).map((p) => p.related_appointment_id));
    const svc = new Map((services ?? []).map((s) => [s.id, s]));
    const staffById = new Map((staff ?? []).map((s) => [s.id, s.full_name]));

    return rows
      .filter((a) => !settled.has(a.id))
      .map((a) => {
        const s = a.service_id ? svc.get(a.service_id) : undefined;
        const techId = a.created_by?.startsWith("tech:") ? a.created_by.slice(5) : null;
        return {
          appointment_id: a.id,
          date: a.scheduled_date,
          time: a.scheduled_time,
          service_name: s?.name ?? a.service_description ?? String(a.appointment_type).replace(/_/g, " "),
          amount_ksh: Number(s?.price_ksh ?? 0),
          technician: techId ? (staffById.get(techId) ?? null) : null,
          status: a.status,
        };
      });
  });

// ---------- M-Pesa STK push ----------

async function darajaStkPush(args: {
  amount: number; phone: string; accountRef: string; description: string; callbackUrl: string;
}): Promise<string | null> {
  const key = process.env['MPESA_CONSUMER_KEY'];
  const secret = process.env['MPESA_CONSUMER_SECRET'];
  const shortcode = process.env['MPESA_SHORTCODE'];
  const passkey = process.env['MPESA_PASSKEY'];
  const env = (process.env['MPESA_ENV'] ?? "sandbox").toLowerCase();
  if (!key || !secret || !shortcode || !passkey) return null;

  const base = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const tokRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!tokRes.ok) throw new Error("M-Pesa authentication failed");
  const { access_token } = await tokRes.json();

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({
      BusinessShortCode: shortcode, Password: password, Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(args.amount),
      PartyA: args.phone, PartyB: shortcode, PhoneNumber: args.phone,
      CallBackURL: args.callbackUrl,
      AccountReference: args.accountRef.slice(0, 12),
      TransactionDesc: args.description.slice(0, 13),
    }),
  });
  const body = await res.json();
  if (!res.ok || body?.ResponseCode !== "0") {
    throw new Error(body?.errorMessage ?? body?.ResponseDescription ?? "STK push rejected");
  }
  return body.CheckoutRequestID as string;
}

const PaymentBase = {
  client_id: z.string().uuid(),
  appointment_id: z.string().uuid().nullable().optional(),
  amount_ksh: z.number().positive(),
  description: z.string().max(200).optional(),
};

export const receptionStartMpesaFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ ...PaymentBase, phone: z.string().min(9).max(20) }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...DESK_ROLES]);
    await assertNotFounder(data.client_id);

    const phone = normalizeMsisdn(data.phone);
    let checkoutId: string | null = null;
    let live = false;
    try {
      const cbUrl = process.env['MPESA_CALLBACK_URL']
        ?? `${process.env['PUBLIC_BASE_URL'] ?? ""}/api/public/mpesa/callback`;
      checkoutId = await darajaStkPush({
        amount: data.amount_ksh,
        phone,
        accountRef: `C${data.client_id.slice(0, 8)}`,
        description: data.description ?? "COTERIE",
        callbackUrl: cbUrl,
      });
      live = !!checkoutId;
    } catch (e: any) {
      console.error("[receptionStartMpesa]", e?.message);
      throw new Error("M-Pesa request could not be sent. Try again or use another method.");
    }

    const { data: row, error } = await supabaseAdmin.from("payments").insert({
      client_id: data.client_id,
      payment_type: "other",
      amount_ksh: data.amount_ksh,
      phone,
      status: "pending",
      mpesa_checkout_request_id: checkoutId,
      description: data.description ?? "Salon service",
      related_appointment_id: data.appointment_id ?? null,
      created_by: await actorTag(staff),
    }).select().single();
    if (error) dbError(error, "receptionStartMpesa");

    return {
      payment_id: row.id,
      status: "pending" as const,
      live,
      message: live
        ? "STK Push sent. Ask the client to check their phone and enter their M-Pesa PIN."
        : "M-Pesa credentials are not configured — payment recorded as pending, no push was sent.",
    };
  });

/** Poll a payment's status — the callback (not the browser) is the source of truth. */
export const getPaymentStatusFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ payment_id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...DESK_ROLES]);
    const { data: p } = await supabaseAdmin
      .from("payments")
      .select("id, status, amount_ksh, mpesa_receipt_number, failure_reason, paid_at, description, related_appointment_id, client_id")
      .eq("id", data.payment_id).maybeSingle();
    if (!p) throw new Error("Payment not found");
    const { data: receipt } = await supabaseAdmin
      .from("receipts").select("*").eq("payment_id", p.id).maybeSingle();
    return { payment: p, receipt: receipt ?? null };
  });

// ---------- Cash ----------

export const receptionRecordCashFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    ...PaymentBase,
    amount_received: z.number().positive(),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...DESK_ROLES]);
    await assertNotFounder(data.client_id);
    if (data.amount_received < data.amount_ksh) throw new Error("Amount received is less than the amount due");

    const receiptNo = genReceiptNumber();
    const { data: payment, error } = await supabaseAdmin.from("payments").insert({
      client_id: data.client_id,
      payment_type: "other",
      amount_ksh: data.amount_ksh,
      phone: "CASH",
      status: "paid",
      paid_at: new Date().toISOString(),
      mpesa_receipt_number: `CASH-${receiptNo.slice(-4)}`,
      description: data.description ?? "Salon service (cash)",
      related_appointment_id: data.appointment_id ?? null,
      created_by: await actorTag(staff),
    }).select().single();
    if (error) dbError(error, "receptionRecordCash");

    const { data: receipt } = await supabaseAdmin.from("receipts").insert({
      payment_id: payment.id,
      client_id: payment.client_id,
      receipt_number: receiptNo,
      amount_ksh: payment.amount_ksh,
      description: payment.description,
    }).select().single();

    if (data.appointment_id) {
      await supabaseAdmin.from("appointments").update({ status: "completed" }).eq("id", data.appointment_id);
    }

    return {
      payment,
      receipt,
      change: Math.round((data.amount_received - data.amount_ksh) * 100) / 100,
      cashier: staff.full_name,
    };
  });

// ---------- Bank card (terminal) ----------

/** Opens a card charge as pending. It only becomes paid via confirmCardPaymentFn
 *  once the terminal/provider reports success. No card data is ever collected. */
export const receptionStartCardFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ ...PaymentBase }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...DESK_ROLES]);
    await assertNotFounder(data.client_id);
    const { data: payment, error } = await supabaseAdmin.from("payments").insert({
      client_id: data.client_id,
      payment_type: "other",
      amount_ksh: data.amount_ksh,
      phone: "CARD",
      status: "pending",
      description: data.description ?? "Salon service (card)",
      related_appointment_id: data.appointment_id ?? null,
      created_by: await actorTag(staff),
    }).select().single();
    if (error) dbError(error, "receptionStartCard");
    return {
      payment_id: payment.id,
      status: "pending" as const,
      message: "Please insert, tap or swipe the client's card on the card terminal.",
    };
  });

export const confirmCardPaymentFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    payment_id: z.string().uuid(),
    outcome: z.enum(["successful", "failed"]),
    terminal_reference: z.string().max(60).optional(),
    failure_reason: z.string().max(200).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...DESK_ROLES]);
    const { data: existing } = await supabaseAdmin
      .from("payments").select("*").eq("id", data.payment_id).maybeSingle();
    if (!existing) throw new Error("Payment not found");
    if (existing.status !== "pending") throw new Error("This payment is already finalised");

    if (data.outcome === "failed") {
      const { data: failed } = await supabaseAdmin.from("payments").update({
        status: "failed",
        failure_reason: data.failure_reason ?? "Card declined at terminal",
      }).eq("id", data.payment_id).select().single();
      return { payment: failed, receipt: null };
    }

    if (!data.terminal_reference?.trim()) {
      throw new Error("A terminal/provider reference is required to confirm a card payment");
    }

    const receiptNo = genReceiptNumber();
    const { data: payment, error } = await supabaseAdmin.from("payments").update({
      status: "paid",
      paid_at: new Date().toISOString(),
      mpesa_receipt_number: `CARD-${data.terminal_reference.trim()}`,
    }).eq("id", data.payment_id).select().single();
    if (error) dbError(error, "confirmCardPayment");

    const { data: receipt } = await supabaseAdmin.from("receipts").insert({
      payment_id: payment.id,
      client_id: payment.client_id,
      receipt_number: receiptNo,
      amount_ksh: payment.amount_ksh,
      description: payment.description,
    }).select().single();

    if (payment.related_appointment_id) {
      await supabaseAdmin.from("appointments").update({ status: "completed" })
        .eq("id", payment.related_appointment_id);
    }
    void staff;
    return { payment, receipt };
  });

// ---------- History ----------

export const listReceptionPaymentsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    status: z.enum(["all", "pending", "paid", "failed", "cancelled"]).default("all"),
    method: z.enum(["all", "mpesa", "cash", "card"]).default("all"),
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(200).default(60),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...DESK_ROLES]);

    // Exclude Founder Circle transactions from the regular payments desk.
    const { data: founderIds } = await supabaseAdmin
      .from("founder_circle").select("client_id").eq("status", "active");
    const founderClients = new Set((founderIds ?? []).map((f) => f.client_id));

    let qb = supabaseAdmin
      .from("payments")
      .select("id, client_id, founder_id, amount_ksh, phone, status, description, mpesa_receipt_number, paid_at, created_at, created_by, related_appointment_id, clients(full_name, phone)")
      .is("founder_id", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.status !== "all") qb = qb.eq("status", data.status);
    if (data.from) qb = qb.gte("created_at", `${data.from}T00:00:00`);
    if (data.to) qb = qb.lte("created_at", `${data.to}T23:59:59`);
    const { data: rows, error } = await qb;
    if (error) dbError(error, "listReceptionPayments");

    const q = sanitize(data.q ?? "").toLowerCase();
    const methodOf = (p: any) =>
      p.phone === "CASH" ? "cash" : p.phone === "CARD" ? "card" : "mpesa";

    return (rows ?? [])
      .filter((p: any) => !founderClients.has(p.client_id))
      .filter((p: any) => data.method === "all" || methodOf(p) === data.method)
      .filter((p: any) => !q || (p.clients?.full_name ?? "").toLowerCase().includes(q))
      .map((p: any) => ({ ...p, method: methodOf(p) }));
  });
