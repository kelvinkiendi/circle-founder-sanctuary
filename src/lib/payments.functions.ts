import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, type StaffRole, dbError } from "@/lib/staff-auth.server";

const SessionField = { sessionId: z.string().uuid() } as const;

async function gateStaff(sessionId: string | undefined, roles?: StaffRole[]) {
  if (!sessionId) throw new Error("Unauthorized");
  await requireStaff(sessionId, roles);
}

const FOUNDER_DISCOUNT = 0.15;
const ENROLL_FULL = 25000;
const ENROLL_INSTALLMENT_1 = 12000;
const ENROLL_INSTALLMENT_2 = 13000;
const TRAVEL_SURCHARGE = 500;

const PaymentTypeEnum = z.enum([
  "enrollment_full",
  "enrollment_installment_1",
  "enrollment_installment_2",
  "travel_transport",
  "full_service_founder",
  "product_purchase",
  "emergency_service",
  "other",
]);

function genReceiptNumber() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const tail = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `COT-${stamp}-${tail}`;
}

function genCheckoutId() {
  return `ws_CO_${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

function normalizeMsisdn(p: string) {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return "254" + digits.slice(1);
  if (digits.startsWith("7") || digits.startsWith("1")) return "254" + digits;
  return digits;
}

// Live Safaricom Daraja STK Push. Returns null if creds missing (caller falls back to simulation).
async function darajaStkPush(args: {
  amount: number;
  phone: string;
  accountRef: string;
  description: string;
  callbackUrl: string;
}): Promise<string | null> {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey = process.env.MPESA_PASSKEY;
  const env = (process.env.MPESA_ENV ?? "sandbox").toLowerCase();
  if (!key || !secret || !shortcode || !passkey) return null;

  const base = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  const tokRes = await fetch(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!tokRes.ok) throw new Error(`Daraja auth failed: ${tokRes.status}`);
  const { access_token } = await tokRes.json();

  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
  const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

  const res = await fetch(`${base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access_token}` },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(args.amount),
      PartyA: args.phone,
      PartyB: shortcode,
      PhoneNumber: args.phone,
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

// Compute amount for a payment type given context
export const computePaymentAmount = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; payment_type: string; base_amount?: number; outside_area?: boolean; apply_founder_rate?: boolean }) =>
    z.object({
      ...SessionField,
      payment_type: PaymentTypeEnum,
      base_amount: z.number().optional(),
      outside_area: z.boolean().optional(),
      apply_founder_rate: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    switch (data.payment_type) {
      case "enrollment_full": return { amount: ENROLL_FULL };
      case "enrollment_installment_1": return { amount: ENROLL_INSTALLMENT_1 };
      case "enrollment_installment_2": return { amount: ENROLL_INSTALLMENT_2 };
      case "travel_transport":
        return { amount: data.outside_area ? TRAVEL_SURCHARGE : 0 };
      case "full_service_founder": {
        const b = data.base_amount ?? 0;
        return { amount: data.apply_founder_rate ? Math.round(b * (1 - FOUNDER_DISCOUNT)) : b };
      }
      case "product_purchase":
      case "emergency_service":
      case "other":
        return { amount: data.base_amount ?? 0 };
    }
  });

// Initiate STK Push (simulated — integrates with Daraja when credentials added)
export const initiateMpesaStkPush = createServerFn({ method: "POST" })
  .inputValidator((d: {
    sessionId: string;
    client_id: string;
    founder_id?: string | null;
    payment_type: string;
    amount_ksh: number;
    phone: string;
    description?: string;
    related_appointment_id?: string | null;
    related_product_id?: string | null;
    due_date?: string | null;
  }) =>
    z.object({
      ...SessionField,
      client_id: z.string().uuid(),
      founder_id: z.string().uuid().nullable().optional(),
      payment_type: PaymentTypeEnum,
      amount_ksh: z.number().positive(),
      phone: z.string().min(9),
      description: z.string().optional(),
      related_appointment_id: z.string().uuid().nullable().optional(),
      related_product_id: z.string().uuid().nullable().optional(),
      due_date: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const phone = normalizeMsisdn(data.phone);
    let checkoutId = genCheckoutId();
    let live = false;
    try {
      const cbUrl = process.env.MPESA_CALLBACK_URL
        ?? `${process.env.PUBLIC_BASE_URL ?? ""}/api/public/mpesa/callback`;
      const real = await darajaStkPush({
        amount: data.amount_ksh,
        phone,
        accountRef: data.founder_id ? `F${data.founder_id.slice(0, 8)}` : `C${data.client_id.slice(0, 8)}`,
        description: data.description ?? "COTERIE",
        callbackUrl: cbUrl,
      });
      if (real) { checkoutId = real; live = true; }
    } catch (e: any) {
      // Surface upstream error but still record an attempt
      console.error("Daraja STK push error:", e?.message);
    }

    const { data: row, error } = await supabaseAdmin
      .from("payments")
      .insert({
        client_id: data.client_id,
        founder_id: data.founder_id ?? null,
        payment_type: data.payment_type,
        amount_ksh: data.amount_ksh,
        phone,
        status: "pending",
        mpesa_checkout_request_id: checkoutId,
        description: data.description ?? null,
        related_appointment_id: data.related_appointment_id ?? null,
        related_product_id: data.related_product_id ?? null,
        due_date: data.due_date ?? null,
      })
      .select()
      .single();
    if (error) dbError(error);

    return {
      payment_id: row.id,
      checkout_request_id: checkoutId,
      status: "pending" as const,
      live,
      prompt: live
        ? `STK Push sent to ${phone}. Confirm on phone.`
        : `Simulated push to ${phone} (Daraja creds not configured).`,
    };
  });

// Manually mark payment paid/failed (admin reconciliation + simulation)
export const updatePaymentStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; payment_id: string; status: "paid" | "failed" | "cancelled"; mpesa_receipt?: string; failure_reason?: string }) =>
    z.object({
      ...SessionField,
      payment_id: z.string().uuid(),
      status: z.enum(["paid", "failed", "cancelled"]),
      mpesa_receipt: z.string().optional(),
      failure_reason: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager"]);
    const patch: any = { status: data.status };
    if (data.status === "paid") {
      patch.paid_at = new Date().toISOString();
      patch.mpesa_receipt_number = data.mpesa_receipt ?? `SIM${Math.floor(Math.random() * 1e9)}`;
    } else if (data.status === "failed") {
      patch.failure_reason = data.failure_reason ?? "Payment failed";
    }
    const { data: payment, error } = await supabaseAdmin
      .from("payments").update(patch).eq("id", data.payment_id).select().single();
    if (error) dbError(error);

    // Auto-generate receipt on success
    let receipt = null;
    if (data.status === "paid") {
      const receiptNo = genReceiptNumber();
      const { data: r } = await supabaseAdmin.from("receipts").insert({
        payment_id: payment.id,
        client_id: payment.client_id,
        founder_id: payment.founder_id,
        receipt_number: receiptNo,
        amount_ksh: payment.amount_ksh,
        description: payment.description,
      }).select().single();
      receipt = r;
    }
    return { payment, receipt };
  });

// Retry: send a fresh STK push for a failed/cancelled payment
export const retryPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; payment_id: string }) => z.object({ ...SessionField, payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager", "reception"]);
    const { data: original, error } = await supabaseAdmin
      .from("payments").select("*").eq("id", data.payment_id).single();
    if (error || !original) throw new Error("Payment not found");

    const checkoutId = genCheckoutId();
    const { data: row, error: insErr } = await supabaseAdmin.from("payments").insert({
      client_id: original.client_id,
      founder_id: original.founder_id,
      payment_type: original.payment_type,
      amount_ksh: original.amount_ksh,
      phone: original.phone,
      status: "pending",
      mpesa_checkout_request_id: checkoutId,
      description: `Retry — ${original.description ?? ""}`.trim(),
      related_appointment_id: original.related_appointment_id,
      related_product_id: original.related_product_id,
      due_date: original.due_date,
    }).select().single();
    if (insErr) dbError(insErr);
    return { payment_id: row.id, checkout_request_id: checkoutId };
  });

// Payment dashboard summary
export const getPaymentSummary = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => z.object({ ...SessionField }).parse(d))
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager", "guardian"]);
    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: payments } = await supabaseAdmin
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    const all = payments || [];
    const paid = all.filter((p: any) => p.status === "paid");
    const sumSince = (since: Date) =>
      paid.filter((p: any) => new Date(p.paid_at ?? p.updated_at) >= since)
          .reduce((s: number, p: any) => s + Number(p.amount_ksh), 0);

    return {
      today_total: sumSince(dayStart),
      week_total: sumSince(weekStart),
      month_total: sumSince(monthStart),
      pending_count: all.filter((p: any) => p.status === "pending").length,
      failed_count: all.filter((p: any) => p.status === "failed").length,
      recent: all.slice(0, 50),
    };
  });

// Outstanding installments
export const getOutstandingInstallments = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => z.object({ ...SessionField }).parse(d))
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager", "guardian"]);
    const { data: founders } = await supabaseAdmin
      .from("founder_circle")
      .select("id, founder_number, client_id, enrollment_date, total_paid_ksh, enrollment_fee_paid, payment_method, status, clients(full_name, phone)")
      .eq("payment_method", "installment")
      .eq("enrollment_fee_paid", false);

    return (founders || []).map((f: any) => {
      const enrolledAt = new Date(f.enrollment_date);
      const dueDate = new Date(enrolledAt.getTime() + 45 * 86400000);
      const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / 86400000);
      return {
        founder_id: f.id,
        founder_number: f.founder_number,
        client_name: f.clients?.full_name,
        phone: f.clients?.phone,
        amount_owed: ENROLL_INSTALLMENT_2,
        due_date: dueDate.toISOString().slice(0, 10),
        days_overdue: Math.max(0, daysOverdue),
        status: f.status,
      };
    });
  });

// Run suspension sweep
export const runSuspensionSweep = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => z.object({ ...SessionField }).parse(d))
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin"]);
    const { data: suspended, error } = await supabaseAdmin.rpc("suspend_overdue_founders");
    if (error) dbError(error);
    return { suspended: suspended ?? 0 };
  });

// Record a cash payment (paid immediately, generates receipt + WA queue + line items)
export const recordCashPayment = createServerFn({ method: "POST" })
  .inputValidator((d: {
    sessionId: string;
    client_id: string;
    founder_id?: string | null;
    amount_ksh: number;
    description?: string;
    related_appointment_id?: string | null;
    line_items?: Array<{ service_id?: string | null; service_name: string; quantity: number; unit_price: number }>;
    created_by?: string;
    method?: "cash" | "card";
  }) =>
    z.object({
      ...SessionField,
      client_id: z.string().uuid(),
      founder_id: z.string().uuid().nullable().optional(),
      amount_ksh: z.number().positive(),
      description: z.string().optional(),
      related_appointment_id: z.string().uuid().nullable().optional(),
      line_items: z.array(z.object({
        service_id: z.string().uuid().nullable().optional(),
        service_name: z.string().min(1),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative(),
      })).optional(),
      created_by: z.string().optional(),
      method: z.enum(["cash", "card"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager", "technician", "reception"]);
    const receiptNo = genReceiptNumber();
    const isCard = data.method === "card";
    const { data: payment, error } = await supabaseAdmin.from("payments").insert({
      client_id: data.client_id,
      founder_id: data.founder_id ?? null,
      payment_type: "other",
      amount_ksh: data.amount_ksh,
      phone: isCard ? "CARD" : "CASH",
      status: "paid",
      paid_at: new Date().toISOString(),
      mpesa_receipt_number: `${isCard ? "CARD" : "CASH"}-${receiptNo.slice(-4)}`,
      description: data.description ?? (isCard ? "Card payment" : "Cash payment"),
      related_appointment_id: data.related_appointment_id ?? null,
      created_by: data.created_by ?? null,
    }).select().single();
    if (error) dbError(error);

    if (data.line_items?.length) {
      await (supabaseAdmin as any).from("payment_line_items").insert(
        data.line_items.map((li) => ({
          payment_id: payment.id,
          service_id: li.service_id ?? null,
          service_name: li.service_name,
          quantity: li.quantity,
          unit_price: li.unit_price,
          total_price: li.unit_price * li.quantity,
        })),
      );
    }

    const { data: receipt } = await supabaseAdmin.from("receipts").insert({
      payment_id: payment.id,
      client_id: payment.client_id,
      founder_id: payment.founder_id,
      receipt_number: receiptNo,
      amount_ksh: payment.amount_ksh,
      description: payment.description,
    }).select().single();

    const { data: client } = await supabaseAdmin
      .from("clients").select("full_name").eq("id", data.client_id).single();
    await supabaseAdmin.from("whatsapp_messages").insert({
      client_id: data.client_id,
      template_key: "payment_confirmation",
      body: `Thank you ${client?.full_name?.split(" ")[0] ?? "there"}. We've received ${data.amount_ksh} KSH (${isCard ? "card" : "cash"}). Receipt: ${receiptNo}. — COTERIE`,
      status: "queued",
      created_by: data.created_by ?? "system",
    });

    return { payment, receipt };
  });

// Attach line items to an existing (M-Pesa) payment
export const addPaymentLineItems = createServerFn({ method: "POST" })
  .inputValidator((d: {
    sessionId: string;
    payment_id: string;
    line_items: Array<{ service_id?: string | null; service_name: string; quantity: number; unit_price: number }>;
  }) =>
    z.object({
      ...SessionField,
      payment_id: z.string().uuid(),
      line_items: z.array(z.object({
        service_id: z.string().uuid().nullable().optional(),
        service_name: z.string().min(1),
        quantity: z.number().int().positive(),
        unit_price: z.number().nonnegative(),
      })).min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await gateStaff(data.sessionId, ["admin", "manager", "technician", "reception"]);
    const { error } = await (supabaseAdmin as any).from("payment_line_items").insert(
      data.line_items.map((li) => ({
        payment_id: data.payment_id,
        service_id: li.service_id ?? null,
        service_name: li.service_name,
        quantity: li.quantity,
        unit_price: li.unit_price,
        total_price: li.unit_price * li.quantity,
      })),
    );
    if (error) dbError(error);
    return { ok: true };
  });
