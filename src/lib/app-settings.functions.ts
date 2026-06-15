import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStaff } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });

/** Any authenticated staff may read a setting. */
export const getSettingFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ key: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { value: (row?.value ?? {}) as any };
  });

/** Admin-only writes. */
export const saveSettingFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    key: z.string().min(1).max(100),
    value: z.record(z.string(), z.any()),
  }).parse(i))
  .handler(async ({ data }) => {
    await requireStaff(data.sessionId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: data.key, value: data.value as any, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
