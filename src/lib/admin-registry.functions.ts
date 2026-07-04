import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });
const WRITE_ROLES = ["admin", "manager", "reception"] as const;
const READ_ROLES = ["admin", "manager", "reception", "partner", "guardian"] as const;

/* ============ Clients registry ============ */

export const listRegistryClientsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    q: z.string().optional().default(""),
    filter: z.enum(["all", "regular", "founder", "prospect", "birthday"]).default("all"),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    let qb = supabaseAdmin.from("clients").select("*")
      .order("created_at", { ascending: false }).limit(200);
    if (staff.role === "technician") qb = qb.eq("created_by", `tech:${staff.staff_id}`);
    if (data.q.trim()) {
      const q = data.q.trim();
      qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%,email.ilike.%${q}%`);
    }
    if (data.filter === "regular") qb = qb.eq("client_type", "regular");
    if (data.filter === "founder") qb = qb.eq("client_type", "founder");
    if (data.filter === "prospect") qb = qb.eq("client_type", "prospect");
    if (data.filter === "birthday") {
      const m = String(new Date().getMonth() + 1).padStart(2, "0");
      qb = qb.like("birthday", `____-${m}-__`);
    }
    const { data: rows, error } = await qb;
    if (error) dbError(error);
    return rows ?? [];
  });

export const getFounderMapFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin.from("founder_circle")
      .select("client_id, founder_number, status");
    return rows ?? [];
  });

export const getLastVisitsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin.from("appointments")
      .select("client_id, scheduled_date")
      .order("scheduled_date", { ascending: false }).limit(500);
    return rows ?? [];
  });

export const searchClientsByNameFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ q: z.string().min(1) }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin.from("clients")
      .select("id, full_name, phone").ilike("full_name", `%${data.q}%`).limit(5);
    return rows ?? [];
  });

const ClientPayload = z.object({
  full_name: z.string().min(1),
  phone: z.string().min(6),
  whatsapp_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  birthday: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  client_type: z.enum(["regular", "prospect", "founder"]).default("regular"),
  referral_source: z.string().nullable().optional(),
  referrer_id: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  first_visit_date: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  reminder_interval_days: z.number().int().min(1).max(365).nullable().optional(),
});

export const upsertRegistryClientFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    id: z.string().uuid().nullable().optional(),
    payload: ClientPayload,
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...WRITE_ROLES, "technician"]);
    const clean: any = { ...data.payload };
    // empty strings -> null for nullable cols
    for (const k of ["email", "birthday", "address", "referral_source", "referrer_id", "notes", "first_visit_date", "avatar_url", "whatsapp_number"]) {
      if (clean[k] === "") clean[k] = null;
    }
    if (data.id) {
      const { data: row, error } = await supabaseAdmin.from("clients")
        .update(clean).eq("id", data.id).select("id").single();
      if (error) dbError(error);
      return row;
    }
    clean.created_by = `${staff.role === "reception" ? "reception" : staff.role === "technician" ? "tech" : staff.role}:${staff.staff_id}`;
    const { data: row, error } = await supabaseAdmin.from("clients")
      .insert(clean).select("id, client_type").single();
    if (error) dbError(error);
    return row;
  });

export const upsertFounderWaitlistFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(), notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const { error } = await supabaseAdmin.from("founder_waitlist").upsert(
      { client_id: data.clientId, priority_score: 10, notes: data.notes ?? null },
      { onConflict: "client_id" },
    );
    if (error) dbError(error);
    return { ok: true };
  });

export const queueWelcomeMessageFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(), body: z.string().min(1),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES, "technician"]);
    const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
      client_id: data.clientId,
      template_key: "welcome_onboard",
      body: data.body,
      status: "sent",
    });
    if (error) dbError(error);
    return { ok: true };
  });

/* ============ Bulk import ============ */

export const getExistingPhonesFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const { data: rows } = await supabaseAdmin.from("clients").select("phone");
    return (rows ?? []).map((r: any) => r.phone).filter(Boolean) as string[];
  });

export const bulkInsertClientsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    rows: z.array(ClientPayload).min(1),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const createdBy = `${staff.role}:${staff.staff_id}`;
    const payload = data.rows.map((r) => ({ ...r, created_by: createdBy }));
    const { data: rows, error } = await supabaseAdmin.from("clients")
      .insert(payload as any).select("id, client_type");
    if (error) dbError(error);
    return rows ?? [];
  });

export const bulkUpdateClientByPhoneFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    phone: z.string().min(6),
    patch: ClientPayload.partial(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const { error } = await supabaseAdmin.from("clients")
      .update(data.patch as any).eq("phone", data.phone);
    if (error) dbError(error);
    return { ok: true };
  });

export const insertFounderWaitlistBulkFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientIds: z.array(z.string().uuid()).min(1),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const { error } = await supabaseAdmin.from("founder_waitlist").insert(
      data.clientIds.map((id) => ({ client_id: id, priority_score: 10 })),
    );
    if (error) dbError(error);
    return { ok: true };
  });

/* ============ Client history ============ */

export const listClientHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin.from("appointments")
      .select("id, appointment_type, scheduled_date, scheduled_time, status, notes")
      .eq("client_id", data.clientId)
      .order("scheduled_date", { ascending: false }).limit(20);
    return rows ?? [];
  });

export const addPastAppointmentFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    appointment_type: z.string(),
    scheduled_date: z.string(),
    scheduled_time: z.string(),
    duration_minutes: z.number().int().min(1),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...WRITE_ROLES]);
    const { error } = await supabaseAdmin.from("appointments").insert({
      client_id: data.clientId,
      appointment_type: data.appointment_type as any,
      scheduled_date: data.scheduled_date,
      scheduled_time: data.scheduled_time,
      duration_minutes: data.duration_minutes,
      status: "completed" as any,
      notes: data.notes || null,
    } as any);
    if (error) dbError(error);
    return { ok: true };
  });

/* ============ Commission editor ============ */

export const getActiveCommissionFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ staffId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin", "manager"]);
    const { data: row } = await supabaseAdmin.from("staff_commission_settings")
      .select("*").eq("staff_id", data.staffId).eq("is_active", true)
      .order("effective_date", { ascending: false }).limit(1).maybeSingle();
    return row;
  });

export const listCommissionHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ staffId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin", "manager"]);
    const { data: rows } = await supabaseAdmin.from("staff_commission_settings")
      .select("id, commission_percentage, commission_type, fixed_amount_ksh, effective_date, notes, created_at")
      .eq("staff_id", data.staffId).order("created_at", { ascending: false }).limit(10);
    return rows ?? [];
  });

export const saveCommissionFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    staffId: z.string().uuid(),
    commission_percentage: z.number().min(0).max(100),
    commission_type: z.enum(["percentage_of_sale", "fixed_per_service", "hybrid"]),
    fixed_amount_ksh: z.number().min(0),
    notes: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    await supabaseAdmin.from("staff_commission_settings")
      .update({ is_active: false }).eq("staff_id", data.staffId).eq("is_active", true);
    const { error } = await supabaseAdmin.from("staff_commission_settings").insert({
      staff_id: data.staffId,
      commission_percentage: data.commission_percentage,
      commission_type: data.commission_type as any,
      fixed_amount_ksh: data.fixed_amount_ksh,
      notes: data.notes || null,
      is_active: true,
    } as any);
    if (error) dbError(error);
    return { ok: true };
  });

/* ============ Data export/import ============ */

export const exportTablesFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    tables: z.array(z.string()).min(1).max(20),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const allow = new Set(["clients", "founder_circle", "appointments", "perks_usage", "payments", "products", "founder_purchases"]);
    const out: Record<string, any[]> = {};
    for (const t of data.tables) {
      if (!allow.has(t)) continue;
      const { data: rows } = await supabaseAdmin.from(t as any).select("*");
      out[t] = rows ?? [];
    }
    return out;
  });

// Update staff (used by admin edit forms)
export const updateStaffFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    staffId: z.string().uuid(),
    patch: z.object({
      full_name: z.string().optional(),
      role: z.enum(["admin", "manager", "technician", "reception", "guardian", "partner"]).optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    }),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const { error } = await supabaseAdmin.from("staff").update(data.patch as any).eq("id", data.staffId);
    if (error) dbError(error);
    return { ok: true };
  });

void READ_ROLES;

/* ============ Front Desk ============ */

export const getTodayAppointmentsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: rows, error } = await supabaseAdmin
      .from("appointments")
      .select("id, scheduled_time, appointment_type, status, created_by, clients(full_name)")
      .eq("scheduled_date", today)
      .order("scheduled_time");
    if (error) dbError(error);
    return rows ?? [];
  });

