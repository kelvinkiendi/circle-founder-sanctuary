import { createServerFn } from "@tanstack/react-start";
import { dbError, requireStaff } from "@/lib/staff-auth.server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FOUNDER_RATE_DISCOUNT = 0.15;
const TRAVEL_SURCHARGE_KSH = 500;
const KILIMANI_CORE_BOUNDS = { latMin: -1.31, latMax: -1.27, lngMin: 36.77, lngMax: 36.81 };

function nairobiWeekStart(d: Date) {
  // Monday 00:00 Nairobi (UTC+3) — simple offset approach
  const nairobi = new Date(d.getTime() + 3 * 3600 * 1000);
  const day = nairobi.getUTCDay() || 7; // Sun=0 -> 7
  nairobi.setUTCDate(nairobi.getUTCDate() - (day - 1));
  nairobi.setUTCHours(0, 0, 0, 0);
  return new Date(nairobi.getTime() - 3 * 3600 * 1000);
}

// ============ FUNCTION 1 ============
export const validateWeeklyRefresh = createServerFn({ method: "POST" })
  .inputValidator((d: { founder_id: string; requested_date: string }) =>
    z.object({ founder_id: z.string().uuid(), requested_date: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const now = new Date();
    const requested = new Date(data.requested_date);
    const weekStart = nairobiWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);

    const hoursAhead = (requested.getTime() - now.getTime()) / 3600000;
    if (hoursAhead > 24)
      return { eligible: false, reason: "Weekly Refresh is same-day or up to 24h ahead.", next_available: requested.toISOString(), reschedules_used: 0 };
    if (hoursAhead < -1)
      return { eligible: false, reason: "Requested date is in the past.", next_available: now.toISOString(), reschedules_used: 0 };

    const { data: perks } = await supabaseAdmin
      .from("perks_usage")
      .select("*, appointments:related_appointment_id(scheduled_date, status)")
      .eq("founder_id", data.founder_id)
      .eq("perk_type", "weekly_refresh")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", weekEnd.toISOString());

    const all = perks || [];
    const used = all.filter((p: any) => p.status === "used");
    const forfeited = all.filter((p: any) => p.status === "forfeited");
    const available = all.filter((p: any) => p.status === "available");

    if (forfeited.length > 0)
      return { eligible: false, reason: "Weekly Refresh forfeited (no-show) for this week.", next_available: weekEnd.toISOString(), reschedules_used: 0 };
    if (used.length > 0)
      return { eligible: false, reason: "Weekly Refresh already used this week.", next_available: weekEnd.toISOString(), reschedules_used: 0 };
    if (available.length === 0)
      return { eligible: false, reason: "No Weekly Refresh perk allocated for this week.", next_available: weekEnd.toISOString(), reschedules_used: 0 };

    // Count cancellations this week as proxy for reschedules
    const { count: reschedules } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("client_id", data.founder_id)
      .eq("appointment_type", "weekly_refresh")
      .gte("scheduled_date", weekStart.toISOString().slice(0, 10))
      .lt("scheduled_date", weekEnd.toISOString().slice(0, 10))
      .eq("status", "cancelled");

    return { eligible: true, reason: "OK", next_available: requested.toISOString(), reschedules_used: reschedules || 0 };
  });

// ============ FUNCTION 2 ============
export const validateGelRescue = createServerFn({ method: "POST" })
  .inputValidator((d: { founder_id: string; damage_reported_date: string; original_service_id: string; damage_cause?: "negligence" | "service_defect" }) =>
    z.object({
      founder_id: z.string().uuid(),
      damage_reported_date: z.string(),
      original_service_id: z.string().uuid(),
      damage_cause: z.enum(["negligence", "service_defect"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: original } = await supabaseAdmin
      .from("appointments")
      .select("*")
      .eq("id", data.original_service_id)
      .maybeSingle();

    if (!original) return { eligible: false, requires_approval: false, reason: "Original service not found", estimated_cost: 0 };

    const origDate = new Date(`${original.scheduled_date}T${original.scheduled_time}`);
    const reported = new Date(data.damage_reported_date);
    const daysSince = (reported.getTime() - origDate.getTime()) / 86400000;

    if (!["full_service", "gel"].some((t) => String(original.appointment_type).includes(t)))
      return { eligible: false, requires_approval: false, reason: "Original service is not a full gel service", estimated_cost: 0 };
    if (daysSince > 7 || daysSince < 0)
      return { eligible: false, requires_approval: false, reason: "Outside 7-day rescue window", estimated_cost: 0 };

    const hoursReporting = (Date.now() - reported.getTime()) / 3600000;
    if (hoursReporting > 48)
      return { eligible: false, requires_approval: false, reason: "Missed 48-hour reporting deadline", estimated_cost: 0 };

    if (data.damage_cause === "negligence")
      return { eligible: false, requires_full_service: true, founder_rate_applies: true, requires_approval: true, estimated_cost: null };

    return { eligible: true, requires_approval: true, estimated_cost: 0 };
  });

// ============ FUNCTION 3 ============
export const validateTravelTouchup = createServerFn({ method: "POST" })
  .inputValidator((d: { founder_id: string; requested_date: string; client_address: string; lat?: number; lng?: number }) =>
    z.object({
      founder_id: z.string().uuid(),
      requested_date: z.string(),
      client_address: z.string(),
      lat: z.number().optional(),
      lng: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const now = new Date();
    const requested = new Date(data.requested_date);
    const hoursAhead = (requested.getTime() - now.getTime()) / 3600000;
    if (hoursAhead < 48)
      return { eligible: false, reason: "Travel Touch-Up needs 48h advance notice", transport_charge: 0, total_cost: 0, workspace_checklist_required: true };

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: used } = await supabaseAdmin
      .from("perks_usage")
      .select("id, status")
      .eq("founder_id", data.founder_id)
      .eq("perk_type", "travel_touchup")
      .gte("created_at", monthStart);

    const usedThisMonth = (used || []).filter((p: any) => p.status === "used").length;
    if (usedThisMonth >= 1)
      return { eligible: false, reason: "Monthly travel touch-up already used", transport_charge: 0, total_cost: 0, workspace_checklist_required: true };

    let transport = 0;
    if (data.lat != null && data.lng != null) {
      const inside =
        data.lat >= KILIMANI_CORE_BOUNDS.latMin && data.lat <= KILIMANI_CORE_BOUNDS.latMax &&
        data.lng >= KILIMANI_CORE_BOUNDS.lngMin && data.lng <= KILIMANI_CORE_BOUNDS.lngMax;
      if (!inside) transport = TRAVEL_SURCHARGE_KSH;
    }

    return { eligible: true, transport_charge: transport, total_cost: transport, workspace_checklist_required: true };
  });

// ============ FUNCTION 4 ============
export const validateBirthdaySanctuary = createServerFn({ method: "POST" })
  .inputValidator((d: { founder_id: string; requested_date: string }) =>
    z.object({ founder_id: z.string().uuid(), requested_date: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: founder } = await supabaseAdmin
      .from("founder_circle")
      .select("*, clients(birthday)")
      .eq("id", data.founder_id)
      .maybeSingle();

    if (!founder?.clients?.birthday)
      return { eligible: false, reason: "No birthday on file" };

    const requested = new Date(data.requested_date);
    const bd = new Date(founder.clients.birthday);
    const thisYearBd = new Date(requested.getFullYear(), bd.getMonth(), bd.getDate());
    const winStart = new Date(thisYearBd.getTime() - 3 * 86400000);
    const winEnd = new Date(thisYearBd.getTime() + 3 * 86400000);

    const inWindow = requested >= winStart && requested <= winEnd;
    const daysAhead = (requested.getTime() - Date.now()) / 86400000;
    const termStart = new Date(founder.enrollment_date);
    const termEnd = founder.term_end_date ? new Date(founder.term_end_date) : null;
    const inTerm = termEnd ? winStart <= termEnd && winEnd >= termStart : false;

    const { data: usedPerks } = await supabaseAdmin
      .from("perks_usage")
      .select("id")
      .eq("founder_id", data.founder_id)
      .eq("perk_type", "birthday_sanctuary")
      .eq("status", "used");

    if ((usedPerks || []).length > 0)
      return { eligible: false, reason: "Birthday sanctuary already used this term", birthday_week_start: winStart, birthday_week_end: winEnd };
    if (!inTerm)
      return { eligible: false, reason: "Birthday falls outside founder term", birthday_week_start: winStart, birthday_week_end: winEnd };
    if (!inWindow)
      return { eligible: false, reason: "Requested date outside 7-day birthday window", birthday_week_start: winStart, birthday_week_end: winEnd, days_until_window: Math.ceil((winStart.getTime() - Date.now()) / 86400000) };
    if (daysAhead < 7)
      return { eligible: false, reason: "Must book 7+ days in advance", birthday_week_start: winStart, birthday_week_end: winEnd };

    return { eligible: true, birthday_week_start: winStart, birthday_week_end: winEnd, days_until_window: Math.max(0, Math.ceil(daysAhead)), gift_bag_reserved: true };
  });

// ============ FUNCTION 5 ============
export const awardSurpriseMoment = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; founder_id: string; surprise_type: "surprise_full" | "random_upgrade" | "just_because"; awarded_by_staff_id: string; reason?: string }) =>
    z.object({
      sessionId: z.string().uuid(),
      founder_id: z.string().uuid(),
      surprise_type: z.enum(["surprise_full", "random_upgrade", "just_because"]),
      awarded_by_staff_id: z.string(),
      reason: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin", "manager"]);
    const { data: founder } = await supabaseAdmin
      .from("founder_circle")
      .select("id, enrollment_date, term_end_date, engagement_score")
      .eq("id", data.founder_id)
      .maybeSingle();
    if (!founder) return { awarded: false, reason: "Founder not found" };

    const { data: history } = await supabaseAdmin
      .from("surprise_moments_log")
      .select("*")
      .eq("founder_id", data.founder_id)
      .gte("awarded_date", founder.enrollment_date);

    const sameType = (history || []).filter((s: any) => s.surprise_type === data.surprise_type);
    let duplicate_warning = false;

    if (data.surprise_type === "surprise_full" && sameType.length >= 2)
      return { awarded: false, reason: "Limit of 2 surprise_full per term reached" };

    if (data.surprise_type === "random_upgrade") {
      if (sameType.length >= 2) return { awarded: false, reason: "Limit of 2 random upgrades per term reached" };
      const last = sameType.sort((a: any, b: any) => +new Date(b.awarded_date) - +new Date(a.awarded_date))[0];
      if (last) {
        const days = (Date.now() - +new Date(last.awarded_date)) / 86400000;
        if (days < 60) return { awarded: false, reason: `60-day cooldown active (${Math.ceil(60 - days)}d remaining)` };
      }
    }

    if (data.surprise_type === "just_because") {
      const { data: ranked } = await supabaseAdmin
        .from("founder_circle")
        .select("id, engagement_score, total_spend, referral_count")
        .eq("status", "active")
        .order("engagement_score", { ascending: false })
        .limit(5);
      if (!(ranked || []).some((r: any) => r.id === data.founder_id))
        return { awarded: false, reason: "Founder not in top 5 by engagement score" };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("surprise_moments_log")
      .insert({
        founder_id: data.founder_id,
        surprise_type: data.surprise_type,
        documented_by: data.awarded_by_staff_id,
        awarded_reason: data.reason ?? null,
      })
      .select()
      .single();
    if (error) { console.error("[awardSurpriseMoment]", error.message); return { awarded: false, reason: "Could not record surprise moment" }; }

    const templates: Record<string, string> = {
      surprise_full: "Your Refresh today is becoming a full Sanctuary Session.",
      random_upgrade: "A little something extra on us today — enjoy your upgrade.",
      just_because: "Just because. A token of appreciation from COTERIE.",
    };

    return { awarded: true, surprise_id: inserted.id, message_template: templates[data.surprise_type], duplicate_warning };
  });

// ============ FUNCTION 6 ============
export const checkFounderRateEligibility = createServerFn({ method: "POST" })
  .inputValidator((d: { founder_id: string }) => z.object({ founder_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const cutoff = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    const { data: last } = await supabaseAdmin
      .from("appointments")
      .select("scheduled_date")
      .eq("client_id", data.founder_id)
      .eq("status", "completed")
      .gte("scheduled_date", cutoff)
      .order("scheduled_date", { ascending: false })
      .limit(1);

    const active = (last || []).length > 0;
    return {
      active,
      discount_percent: active ? FOUNDER_RATE_DISCOUNT * 100 : 0,
      last_service_date: last?.[0]?.scheduled_date ?? null,
      reactivation_required: !active,
    };
  });

// ============ FUNCTION 7 ============
export const processEnrollment = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string; client_id: string; founder_number: number; payment_method: "full" | "installment"; installment_amount?: number }) =>
    z.object({
      sessionId: z.string().uuid(),
      client_id: z.string().uuid(),
      founder_number: z.number().int().min(1).max(25),
      payment_method: z.enum(["full", "installment"]),
      installment_amount: z.number().positive().optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const { data: existing } = await supabaseAdmin
      .from("founder_circle")
      .select("id")
      .eq("founder_number", data.founder_number)
      .maybeSingle();
    if (existing) throw new Error(`Founder position #${data.founder_number} already assigned`);

    const enrollmentDate = new Date();
    const termEnd = new Date(enrollmentDate);
    termEnd.setMonth(termEnd.getMonth() + 6);

    const { data: founder, error } = await supabaseAdmin
      .from("founder_circle")
      .insert({
        client_id: data.client_id,
        founder_number: data.founder_number,
        enrollment_date: enrollmentDate.toISOString().slice(0, 10),
        term_end_date: termEnd.toISOString().slice(0, 10),
        payment_method: data.payment_method,
        installment_count: data.payment_method === "installment" ? 2 : 1,
        total_paid_ksh: data.installment_amount ?? 0,
        enrollment_fee_paid: data.payment_method === "full",
        status: "active",
      })
      .select()
      .single();
    if (error) dbError(error);

    // Generate perks: 26 weekly, 6 travel, 1 birthday
    const perks: any[] = [];
    for (let w = 1; w <= 26; w++) {
      const exp = new Date(enrollmentDate.getTime() + w * 7 * 86400000);
      perks.push({ founder_id: founder.id, perk_type: "weekly_refresh", week_number: w, status: "available", expiry_date: exp.toISOString().slice(0, 10) });
    }
    for (let m = 1; m <= 6; m++) {
      const exp = new Date(enrollmentDate); exp.setMonth(exp.getMonth() + m);
      perks.push({ founder_id: founder.id, perk_type: "travel_touchup", month_number: m, status: "available", expiry_date: exp.toISOString().slice(0, 10) });
    }
    perks.push({ founder_id: founder.id, perk_type: "birthday_sanctuary", status: "available", expiry_date: termEnd.toISOString().slice(0, 10) });
    await supabaseAdmin.from("perks_usage").insert(perks);

    await supabaseAdmin.from("notifications").insert({
      founder_id: founder.id,
      kind: "enrollment_welcome",
      message: `Welcome to The Circle, Founder #${data.founder_number}.`,
    });

    const nextPaymentDue =
      data.payment_method === "installment"
        ? new Date(enrollmentDate.getTime() + 30 * 86400000).toISOString().slice(0, 10)
        : null;

    return {
      founder_id: founder.id,
      term_end_date: founder.term_end_date,
      perks_created_count: perks.length,
      next_payment_due: nextPaymentDue,
    };
  });
