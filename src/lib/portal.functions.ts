import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });

// ============ Dashboard ============

export const getDashboardStatsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const today = new Date().toISOString().slice(0, 10);
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    const weekStart = d.toISOString().slice(0, 10);

    const [clients, founders, todayAppts, weeklyRefresh, upcoming] = await Promise.all([
      supabaseAdmin.from("clients").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("founder_circle").select("*", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("appointments").select("id, scheduled_time, appointment_type, location, status, clients(full_name)").eq("scheduled_date", today).order("scheduled_time"),
      supabaseAdmin.from("perks_usage").select("*", { count: "exact", head: true }).eq("perk_type", "weekly_refresh").eq("status", "used").gte("used_date", weekStart),
      supabaseAdmin.from("appointments").select("id, scheduled_date, scheduled_time, appointment_type, clients(full_name)").gte("scheduled_date", today).order("scheduled_date").limit(5),
    ]);
    return {
      clientsCount: clients.count ?? 0,
      foundersCount: founders.count ?? 0,
      todayAppointments: (todayAppts.data ?? []) as any[],
      weeklyRefreshCount: weeklyRefresh.count ?? 0,
      upcoming: (upcoming.data ?? []) as any[],
    };
  });

// ============ Artisan reads ============

export const getArtisanAppointmentsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ techTag: z.string(), today: z.string() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin
      .from("appointments")
      .select("id, scheduled_date, scheduled_time, duration_minutes, appointment_type, status, location, notes, created_by, client_id, clients(full_name, phone, client_type)")
      .eq("created_by", data.techTag)
      .gte("scheduled_date", data.today)
      .order("scheduled_date")
      .order("scheduled_time");
    return rows ?? [];
  });

export const getArtisanCollectionFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ techTag: z.string(), today: z.string() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const start = `${data.today}T00:00:00`;
    const end = `${data.today}T23:59:59`;
    const { data: rows } = await supabaseAdmin
      .from("payments")
      .select("id, amount_ksh, phone, status, mpesa_receipt_number, description, paid_at, created_by")
      .eq("status", "paid")
      .eq("created_by", data.techTag)
      .gte("paid_at", start)
      .lte("paid_at", end)
      .order("paid_at", { ascending: false });
    return rows ?? [];
  });

// ============ Clients ============

export const searchClientsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    q: z.string().max(120).optional(),
    fields: z.enum(["mini", "full"]).default("mini"),
    limit: z.number().int().min(1).max(50).default(15),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    const cols = data.fields === "full"
      ? "id, full_name, phone, whatsapp_number, client_type, notes, created_by, last_appointment_date, next_visit_predicted_date, reminder_interval_days, whatsapp_opt_out"
      : "id, full_name, phone, whatsapp_number, client_type";
    let qb = supabaseAdmin.from("clients").select(cols).limit(data.limit);
    // Technicians only see clients they added
    if (staff.role === "technician") {
      qb = qb.eq("created_by", `tech:${staff.staff_id}`);
    }
    if (data.q?.trim()) {
      // Allowlist alphanumerics, spaces, and hyphens to prevent PostgREST filter injection.
      const q = data.q.replace(/[^\w\s-]/g, "").slice(0, 80);
      if (q) {
        qb = qb.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,whatsapp_number.ilike.%${q}%`);
      }
    }
    const { data: rows } = await qb;
    return rows ?? [];
  });

export const getClientByIdFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    const { data: row } = await supabaseAdmin.from("clients").select("*").eq("id", data.id).maybeSingle();
    if (!row) return null;
    if (staff.role === "technician" && row.created_by !== `tech:${staff.staff_id}`) {
      throw new Error("Forbidden");
    }
    return row;
  });

export const getFirstClientIdFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    let qb = supabaseAdmin.from("clients").select("id").limit(1);
    if (staff.role === "technician") qb = qb.eq("created_by", `tech:${staff.staff_id}`);
    const { data: row } = await qb.maybeSingle();
    return row;
  });

export const createClientFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    full_name: z.string().min(1).max(200),
    phone: z.string().min(6).max(40),
    whatsapp_number: z.string().min(6).max(40).optional(),
    notes: z.string().max(500).optional(),
    reminder_interval_days: z.number().int().min(1).max(365).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    const createdBy = `${staff.role === "reception" ? "reception" : staff.role === "technician" ? "tech" : staff.role}:${staff.staff_id}`;
    const { data: row, error } = await supabaseAdmin.from("clients").insert({
      full_name: data.full_name,
      phone: data.phone,
      whatsapp_number: data.whatsapp_number ?? data.phone,
      client_type: "regular",
      notes: data.notes ?? null,
      created_by: createdBy,
      reminder_interval_days: data.reminder_interval_days ?? null,
    }).select().single();
    if (error) dbError(error);
    return row;
  });

export const updateClientReminderFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    days: z.number().int().min(1).max(365).nullable(),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, ["admin", "manager", "reception"]);
    void staff;
    const { error } = await supabaseAdmin
      .from("clients").update({ reminder_interval_days: data.days }).eq("id", data.clientId);
    if (error) dbError(error);
    return { ok: true };
  });

export const sendReminderNowFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, ["admin", "manager", "reception"]);
    const { data: c } = await supabaseAdmin
      .from("clients")
      .select("id, full_name, whatsapp_number, phone, last_appointment_date, whatsapp_opt_out")
      .eq("id", data.clientId).maybeSingle();
    if (!c) throw new Error("Client not found");
    if (c.whatsapp_opt_out) throw new Error("Client has opted out of WhatsApp");
    const { data: settingRow } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "visit_reminder").maybeSingle();
    const tpl = ((settingRow?.value as any)?.template as string | undefined)
      ?? "Hi {first_name} ✨ It's been a while since your last visit ({last_date}). Your nails are ready for a refresh — reply to book at COTERIE. 💅";
    const firstName = (c.full_name ?? "there").split(" ")[0];
    const lastDate = c.last_appointment_date
      ? new Date(c.last_appointment_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : "your last visit";
    const body = tpl.replace(/\{first_name\}/g, firstName).replace(/\{last_date\}/g, lastDate);
    const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
      client_id: c.id,
      template_key: "visit_reminder_21d",
      body,
      status: "queued",
      created_by: `staff:${staff.staff_id}`,
    });
    if (error) dbError(error);
    return { ok: true };
  });

export const listReminderHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid().optional(),
    limit: z.number().int().min(1).max(100).default(25),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    let qb = supabaseAdmin
      .from("whatsapp_messages")
      .select("id, client_id, body, status, sent_at, created_by, clients(full_name)")
      .eq("template_key", "visit_reminder_21d")
      .order("sent_at", { ascending: false })
      .limit(data.limit);
    if (data.clientId) qb = qb.eq("client_id", data.clientId);
    const { data: rows } = await qb;
    return rows ?? [];
  });


export const setClientOptOutFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    optedOut: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { error } = await supabaseAdmin.from("clients").update({ whatsapp_opt_out: data.optedOut }).eq("id", data.clientId);
    if (error) dbError(error);
    return { ok: true };
  });

// ============ Founder + Perks ============

export const getFounderWithPerksFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ clientId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: row } = await supabaseAdmin
      .from("founder_circle")
      .select("*, perks_usage(*)")
      .eq("client_id", data.clientId)
      .maybeSingle();
    return row;
  });

export const redeemPerkFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    perkType: z.string().max(40),
    appointmentId: z.string().uuid(),
    date: z.string(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: founder } = await supabaseAdmin
      .from("founder_circle").select("id").eq("client_id", data.clientId).maybeSingle();
    if (!founder?.id) return { ok: false as const };
    const { error } = await supabaseAdmin.from("perks_usage").update({
      status: "used", used_date: data.date, related_appointment_id: data.appointmentId,
    }).eq("perk_type", data.perkType as any).eq("status", "available").eq("founder_id", founder.id);
    if (error) dbError(error);
    return { ok: true as const };
  });

// ============ Appointments ============

const AppointmentInsert = z.object({
  client_id: z.string().uuid(),
  appointment_type: z.string(),
  service_id: z.string().uuid().nullable().optional(),
  service_description: z.string().max(200).nullable().optional(),
  scheduled_date: z.string(),
  scheduled_time: z.string(),
  duration_minutes: z.number().int().min(5).max(600),
  location: z.enum(["studio", "travel"]).default("studio"),
  notes: z.string().max(800).nullable().optional(),
  status: z.string().default("booked"),
  created_by: z.string().max(120).nullable().optional(),
});

export const createAppointmentFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ appt: AppointmentInsert }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: row, error } = await supabaseAdmin
      .from("appointments")
      .insert(data.appt as any)
      .select().single();
    if (error) dbError(error);
    return row;
  });

// ============ Activity + Notifications ============

export const logActivityFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    entity: z.string().max(60),
    entity_id: z.string().uuid().optional(),
    action: z.string().max(60),
    actor: z.string().max(120).optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    await supabaseAdmin.from("activity_log").insert({
      entity: data.entity,
      entity_id: data.entity_id ?? null,
      action: data.action,
      actor: data.actor ?? null,
      metadata: data.metadata ?? null,
    });
    return { ok: true };
  });

export const createNotificationFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    kind: z.string().max(60),
    message: z.string().max(500),
    founder_id: z.string().uuid().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    await supabaseAdmin.from("notifications").insert({
      kind: data.kind,
      message: data.message,
      founder_id: data.founder_id ?? null,
    });
    return { ok: true };
  });

// ============ Services ============

export const getActiveServicesFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin
      .from("services")
      .select("id, name, price_ksh, duration_minutes")
      .eq("status", "active")
      .order("display_order");
    return rows ?? [];
  });

// ============ Earnings ============

export const getCommissionRateFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ staffId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const today = new Date().toISOString().slice(0, 10);
    const { data: row } = await supabaseAdmin
      .from("staff_commission_settings")
      .select("commission_percentage, commission_type, fixed_amount_ksh")
      .eq("staff_id", data.staffId)
      .eq("is_active", true)
      .lte("effective_date", today)
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row ?? { commission_percentage: 0, commission_type: "percentage_of_sale", fixed_amount_ksh: 0 };
  });

export const getEarningsRangeFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    staffId: z.string().uuid(),
    from: z.string(),
    to: z.string(),
  }).parse(i))
  .handler(async ({ data }) => {
    const me = await requireStaff(data.sessionId);
    // A technician can only see their own earnings; admin/manager can see anyone's.
    if (!["admin", "manager"].includes(me.role) && me.staff_id !== data.staffId) {
      throw new Error("Forbidden");
    }
    const { data: rows } = await supabaseAdmin
      .from("staff_earnings")
      .select("id, earnings_date, service_name, sale_amount_ksh, commission_percentage, total_commission_ksh, created_at")
      .eq("staff_id", data.staffId)
      .gte("earnings_date", data.from)
      .lte("earnings_date", data.to)
      .order("earnings_date", { ascending: false })
      .order("created_at", { ascending: false });
    return rows ?? [];
  });

// ============ WhatsApp ============

export const getWhatsAppHistoryFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    limit: z.number().int().min(1).max(50).default(15),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows } = await supabaseAdmin
      .from("whatsapp_messages")
      .select("*")
      .eq("client_id", data.clientId)
      .order("sent_at", { ascending: false })
      .limit(data.limit);
    return rows ?? [];
  });

export const logWhatsAppMessageFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    clientId: z.string().uuid(),
    templateKey: z.string().max(60),
    body: z.string().min(1).max(4000),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: client } = await supabaseAdmin
      .from("clients").select("whatsapp_opt_out").eq("id", data.clientId).maybeSingle();
    if (client?.whatsapp_opt_out) throw new Error("Client opted out of WhatsApp");
    const { error } = await supabaseAdmin.from("whatsapp_messages").insert({
      client_id: data.clientId,
      template_key: data.templateKey,
      body: data.body,
      status: "sent",
    });
    if (error) dbError(error);
    return { ok: true };
  });
