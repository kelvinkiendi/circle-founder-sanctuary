import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });
const READERS = ["admin", "manager", "guardian", "partner"] as const;

/** High-level audit summary for the snapshot widgets. */
export const getAuditSummaryFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...READERS]);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const start7 = new Date(now.getTime() - 7 * 86400000).toISOString();
    const start30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [
      events7,
      events30,
      paidToday,
      paid7,
      failed7,
      loginFails7,
      lockedStaff,
      activeStaff,
      recentEvents,
    ] = await Promise.all([
      supabaseAdmin.from("activity_log").select("id", { count: "exact", head: true }).gte("created_at", start7),
      supabaseAdmin.from("activity_log").select("id", { count: "exact", head: true }).gte("created_at", start30),
      supabaseAdmin.from("payments").select("amount_ksh").eq("status", "paid").gte("paid_at", `${today}T00:00:00`).lte("paid_at", `${today}T23:59:59`),
      supabaseAdmin.from("payments").select("amount_ksh").eq("status", "paid").gte("paid_at", start7),
      supabaseAdmin.from("payments").select("id", { count: "exact", head: true }).in("status", ["failed", "cancelled"]).gte("created_at", start7),
      supabaseAdmin.from("staff_login_log").select("id", { count: "exact", head: true }).eq("success", false).gte("attempted_at", start7),
      supabaseAdmin.from("staff").select("id", { count: "exact", head: true }).not("locked_until", "is", null).gt("locked_until", new Date().toISOString()),
      supabaseAdmin.from("staff").select("id", { count: "exact", head: true }).eq("active", true),
      supabaseAdmin.from("activity_log").select("id, action, entity, actor, created_at, metadata").order("created_at", { ascending: false }).limit(8),
    ]);

    const sum = (arr: any[] | null | undefined) =>
      (arr ?? []).reduce((acc: number, r: any) => acc + Number(r.amount_ksh || 0), 0);

    return {
      events7: events7.count ?? 0,
      events30: events30.count ?? 0,
      paidTodayKsh: sum(paidToday.data),
      paid7Ksh: sum(paid7.data),
      failedPayments7: failed7.count ?? 0,
      loginFails7: loginFails7.count ?? 0,
      lockedStaff: lockedStaff.count ?? 0,
      activeStaff: activeStaff.count ?? 0,
      recentEvents: (recentEvents.data ?? []) as any[],
    };
  });

/** Distinct action and entity values used for filter dropdowns. */
export const getAuditFiltersFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...READERS]);
    const [{ data: rows }, { data: staff }] = await Promise.all([
      supabaseAdmin.from("activity_log").select("action, entity, actor").limit(2000),
      supabaseAdmin.from("staff").select("id, full_name, role").eq("active", true).order("full_name"),
    ]);
    const actions = Array.from(new Set((rows ?? []).map((r: any) => r.action).filter(Boolean))).sort();
    const entities = Array.from(new Set((rows ?? []).map((r: any) => r.entity).filter(Boolean))).sort();
    const actors = Array.from(new Set((rows ?? []).map((r: any) => r.actor).filter(Boolean))).sort();
    return { actions, entities, actors, staff: staff ?? [] };
  });

/** Filtered audit events (paged). */
export const listAuditEventsFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    from: z.string().min(10).max(10).optional(),       // YYYY-MM-DD
    to: z.string().min(10).max(10).optional(),
    action: z.string().max(80).optional(),
    entity: z.string().max(80).optional(),
    actor: z.string().max(120).optional(),
    limit: z.number().int().min(1).max(2000).default(500),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, [...READERS]);
    let qb = supabaseAdmin
      .from("activity_log")
      .select("id, action, entity, entity_id, actor, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) qb = qb.gte("created_at", `${data.from}T00:00:00`);
    if (data.to) qb = qb.lte("created_at", `${data.to}T23:59:59`);
    if (data.action) qb = qb.eq("action", data.action);
    if (data.entity) qb = qb.eq("entity", data.entity);
    if (data.actor) qb = qb.eq("actor", data.actor);
    const { data: rows, error } = await qb;
    if (error) dbError(error);
    return rows ?? [];
  });
