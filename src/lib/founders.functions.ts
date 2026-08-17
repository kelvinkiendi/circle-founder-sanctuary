import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });

export const FOUNDER_SLOTS = 25;
const TERM_WEEKS = 26;
const TRAVEL_PER_TERM = 6;
const ENROLLMENT_FEE = 25000;

/** Roles allowed to enroll founders. Technicians / guardians / partners cannot. */
const ENROLL_ROLES = ["admin", "manager", "reception"] as const;

function sanitize(q: string) {
  return q.replace(/[^\w\s@.\-+]/g, "").slice(0, 80).trim();
}

// ---------- Reads ----------

export const listFoundersFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { data: rows, error } = await supabaseAdmin
      .from("founder_circle")
      .select("*, clients(*)")
      .order("founder_number", { ascending: true, nullsFirst: false });
    if (error) dbError(error, "listFounders");
    return rows ?? [];
  });

/** Search existing clients (name / phone / email) with their founder status attached. */
export const searchClientsForEnrollmentFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    q: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(25).default(10),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...ENROLL_ROLES]);
    let qb = supabaseAdmin
      .from("clients")
      .select("id, full_name, phone, email, whatsapp_number, client_type, status")
      .order("full_name")
      .limit(data.limit);
    const q = sanitize(data.q ?? "");
    if (q) {
      qb = qb.or(
        `full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,whatsapp_number.ilike.%${q}%`,
      );
    }
    const { data: clients, error } = await qb;
    if (error) dbError(error, "searchClientsForEnrollment");
    const ids = (clients ?? []).map((c) => c.id);
    if (!ids.length) return [];
    const { data: founders } = await supabaseAdmin
      .from("founder_circle")
      .select("id, client_id, founder_number, status")
      .in("client_id", ids);
    const byClient = new Map((founders ?? []).map((f) => [f.client_id, f]));
    return (clients ?? []).map((c) => {
      const f = byClient.get(c.id);
      return {
        ...c,
        founder_id: f?.id ?? null,
        founder_number: f?.founder_number ?? null,
        founder_status: f?.status ?? null,
        is_active_founder: f?.status === "active",
      };
    });
  });

export const getCircleCapacityFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { count } = await supabaseAdmin
      .from("founder_circle")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    const active = count ?? 0;
    return { active, total: FOUNDER_SLOTS, remaining: Math.max(0, FOUNDER_SLOTS - active) };
  });

// ---------- Enrollment ----------

const NewClient = z.object({
  full_name: z.string().min(1).max(200),
  phone: z.string().max(40).optional(),
  email: z.string().max(160).optional(),
  whatsapp_number: z.string().max(40).optional(),
  birthday: z.string().optional(),
  address: z.string().max(300).optional(),
});

export const enrollFounderFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    mode: z.enum(["existing", "new"]),
    client_id: z.string().uuid().optional(),
    new_client: NewClient.optional(),
    founder_number: z.number().int().min(1).max(FOUNDER_SLOTS),
    enrollment_date: z.string(),
    payment_method: z.enum(["full", "installment"]),
    first_installment: z.number().nonnegative().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, [...ENROLL_ROLES]);

    // 1. 25-seat limit (server-enforced, cannot be bypassed from the UI)
    const { count: activeCount } = await supabaseAdmin
      .from("founder_circle")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    if ((activeCount ?? 0) >= FOUNDER_SLOTS) {
      throw new Error(`The Circle is full — ${FOUNDER_SLOTS} active founders. Enrollment is closed.`);
    }

    // 2. Seat number must be free
    const { data: seat } = await supabaseAdmin
      .from("founder_circle")
      .select("id")
      .eq("founder_number", data.founder_number)
      .maybeSingle();
    if (seat) throw new Error(`Founder No. ${data.founder_number} is already taken.`);

    // 3. Resolve the client — never create a duplicate
    let clientId: string;
    if (data.mode === "existing") {
      if (!data.client_id) throw new Error("Select an existing client");
      const { data: existing } = await supabaseAdmin
        .from("clients").select("id").eq("id", data.client_id).maybeSingle();
      if (!existing) throw new Error("Client not found");
      clientId = existing.id;
    } else {
      const nc = data.new_client;
      if (!nc?.full_name?.trim()) throw new Error("Client name is required");
      // Guard against creating a duplicate of an existing phone/email
      if (nc.phone || nc.email) {
        const filters = [
          nc.phone ? `phone.eq.${sanitize(nc.phone)}` : null,
          nc.email ? `email.eq.${sanitize(nc.email)}` : null,
        ].filter(Boolean).join(",");
        const { data: dup } = await supabaseAdmin
          .from("clients").select("id, full_name").or(filters).maybeSingle();
        if (dup) {
          throw new Error(`A client with that phone/email already exists (${dup.full_name}). Use "Existing Client".`);
        }
      }
      const { data: created, error } = await supabaseAdmin.from("clients").insert({
        full_name: nc.full_name.trim(),
        phone: nc.phone || null,
        email: nc.email || null,
        whatsapp_number: nc.whatsapp_number || nc.phone || null,
        birthday: nc.birthday || null,
        address: nc.address || null,
        client_type: "founder",
        created_by: `${staff.role}:${staff.staff_id}`,
      }).select("id").single();
      if (error) dbError(error, "enrollFounder.createClient");
      clientId = created.id;
    }

    // 4. No duplicate founder record for the same client
    const { data: existingFounder } = await supabaseAdmin
      .from("founder_circle")
      .select("id, status, founder_number")
      .eq("client_id", clientId)
      .maybeSingle();
    if (existingFounder) {
      throw new Error(
        existingFounder.status === "active"
          ? `This client is already Founder No. ${existingFounder.founder_number}.`
          : "This client already has a Founder record — reactivate it instead of enrolling again.",
      );
    }

    // 5. Create the founder record
    const enrollDate = new Date(data.enrollment_date);
    const termEnd = new Date(enrollDate);
    termEnd.setMonth(termEnd.getMonth() + 6);
    const totalPaid = data.payment_method === "full" ? ENROLLMENT_FEE : (data.first_installment ?? 0);

    const { data: founder, error: fErr } = await supabaseAdmin.from("founder_circle").insert({
      client_id: clientId,
      founder_number: data.founder_number,
      enrollment_date: data.enrollment_date,
      term_end_date: termEnd.toISOString().slice(0, 10),
      enrollment_fee_paid: data.payment_method === "full",
      payment_method: data.payment_method,
      installment_count: data.payment_method === "installment" ? 1 : 0,
      total_paid_ksh: totalPaid,
      status: "active",
    }).select().single();
    if (fErr) dbError(fErr, "enrollFounder.createFounder");

    await supabaseAdmin.from("clients").update({ client_type: "founder" }).eq("id", clientId);

    // 6. Seed perks
    const perkRows: any[] = [];
    for (let w = 1; w <= TERM_WEEKS; w++) {
      perkRows.push({ founder_id: founder.id, perk_type: "weekly_refresh", week_number: w, status: "available" });
    }
    for (let m = 1; m <= TRAVEL_PER_TERM; m++) {
      perkRows.push({ founder_id: founder.id, perk_type: "travel_touchup", month_number: m, status: "available" });
    }
    perkRows.push({ founder_id: founder.id, perk_type: "birthday_sanctuary", status: "available" });
    await supabaseAdmin.from("perks_usage").insert(perkRows);

    await supabaseAdmin.from("activity_log").insert({
      entity: "founder_circle",
      entity_id: founder.id,
      action: "founder_enrolled",
      actor: `${staff.role}:${staff.full_name}`,
      metadata: { client_id: clientId, founder_number: data.founder_number, mode: data.mode },
    });

    return founder;
  });

/** Full founder profile bundle (perks, appointments, surprises, purchases). */
export const getFounderProfileFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    founderId: z.string().uuid(),
    clientId: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const [perks, appointments, surprises, purchases] = await Promise.all([
      supabaseAdmin.from("perks_usage").select("*").eq("founder_id", data.founderId),
      supabaseAdmin.from("appointments").select("*").eq("client_id", data.clientId).order("scheduled_date", { ascending: false }),
      supabaseAdmin.from("surprise_moments_log").select("*").eq("founder_id", data.founderId).order("awarded_date", { ascending: false }),
      supabaseAdmin.from("founder_purchases").select("*, products(name)").eq("founder_id", data.founderId).order("purchase_date", { ascending: false }),
    ]);
    return {
      perks: perks.data ?? [],
      appointments: appointments.data ?? [],
      surprises: surprises.data ?? [],
      purchases: purchases.data ?? [],
    };
  });
