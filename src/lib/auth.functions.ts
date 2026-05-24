import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/),
  device: z.string().max(120).optional(),
  userAgent: z.string().max(400).optional(),
});

export const loginWithPin = createServerFn({ method: "POST" })
  .inputValidator((i) => PinSchema.parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("verify_staff_pin", {
      p_pin: data.pin,
      p_device: data.device ?? undefined,
      p_user_agent: data.userAgent ?? undefined,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false as const };
    return {
      ok: true as const,
      sessionId: row.session_id as string,
      staffId: row.staff_id as string,
      fullName: row.full_name as string,
      role: row.role as string,
      mustChangePin: row.must_change_pin as boolean,
      lastLoginAt: row.last_login_at as string | null,
    };
  });

export const getSessionFn = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin.rpc("get_staff_session", {
      p_session: data.sessionId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) return { ok: false as const };
    return {
      ok: true as const,
      sessionId: row.session_id as string,
      staffId: row.staff_id as string,
      fullName: row.full_name as string,
      role: row.role as string,
      mustChangePin: row.must_change_pin as boolean,
      lastLoginAt: row.last_login_at as string | null,
    };
  });

export const logoutFn = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({ sessionId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await supabaseAdmin.rpc("end_staff_session", { p_session: data.sessionId });
    return { ok: true };
  });

export const changePinFn = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    sessionId: z.string().uuid(),
    newPin: z.string().regex(/^\d{4}$/),
  }).parse(i))
  .handler(async ({ data }) => {
    const { data: ok, error } = await supabaseAdmin.rpc("change_staff_pin", {
      p_session: data.sessionId, p_new_pin: data.newPin,
    });
    if (error) throw new Error(error.message);
    return { ok: !!ok };
  });

export const adminResetPinFn = createServerFn({ method: "POST" })
  .inputValidator((i) => z.object({
    sessionId: z.string().uuid(),
    staffId: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data }) => {
    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    const { data: ok, error } = await supabaseAdmin.rpc("admin_reset_pin", {
      p_admin_session: data.sessionId, p_staff_id: data.staffId, p_new_pin: newPin,
    });
    if (error) throw new Error(error.message);
    if (!ok) return { ok: false as const };
    return { ok: true as const, tempPin: newPin };
  });
