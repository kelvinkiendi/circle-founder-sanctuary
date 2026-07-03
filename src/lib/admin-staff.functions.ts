import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });
const ROLES = ["admin", "manager", "technician", "reception", "guardian", "partner"] as const;

/** Admin-only: list every staff member with PIN status. */
export const listStaffFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ role: z.enum(ROLES).optional() }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    let qb = supabaseAdmin
      .from("staff")
      .select("id, full_name, role, email, phone, active, status, must_change_pin, pin_hash, last_login_at, created_at")
      .order("created_at", { ascending: false });
    if (data.role) qb = qb.eq("role", data.role);
    const { data: rows, error } = await qb;
    if (error) dbError(error);
    return (rows ?? []).map((r: any) => ({
      ...r,
      pin_set: !!r.pin_hash,
      pin_hash: undefined, // never leak hashes
    }));
  });

/** Admin-only: create a staff row (typically a partner). PIN is set in a follow-up call. */
export const createStaffFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    full_name: z.string().min(2).max(200),
    role: z.enum(ROLES),
    email: z.string().email().max(200).optional().or(z.literal("")),
    phone: z.string().max(40).optional().or(z.literal("")),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const { data: row, error } = await supabaseAdmin
      .from("staff")
      .insert({
        full_name: data.full_name,
        role: data.role as any,
        email: data.email || null,
        phone: data.phone || null,
        active: true,
        status: "active",
        must_change_pin: true,
      } as any)
      .select("id, full_name, role")
      .single();
    if (error) dbError(error);
    return row;
  });

/** Admin-only: toggle active flag. */
export const setStaffActiveFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    staffId: z.string().uuid(),
    active: z.boolean(),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const { error } = await supabaseAdmin
      .from("staff").update({ active: data.active }).eq("id", data.staffId);
    if (error) dbError(error);
    return { ok: true };
  });

/** Admin-only: hard delete (use sparingly). */
export const deleteStaffFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ staffId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const me = await requireStaff(data.sessionId, ["admin"]);
    if (me.staff_id === data.staffId) throw new Error("Cannot delete yourself");
    const { error } = await supabaseAdmin.from("staff").delete().eq("id", data.staffId);
    if (error) dbError(error);
    return { ok: true };
  });
