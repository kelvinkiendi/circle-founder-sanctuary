import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireStaff, dbError } from "@/lib/staff-auth.server";

const Session = z.object({ sessionId: z.string().uuid() });

// Keys that contain operational rules / secrets — admin only, manager may read.
const ADMIN_ONLY_KEYS = new Set(["founder_rules", "integrations", "data"]);

/** Any authenticated staff may read most settings; sensitive keys are restricted. */
export const getSettingFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({ key: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId);
    if (ADMIN_ONLY_KEYS.has(data.key) && !["admin", "manager"].includes(staff.role)) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    if (error) dbError(error);
    return { value: (row?.value ?? {}) as any };
  });

/** Compute a shallow diff between two objects: {key: {before, after}}. */
function shallowDiff(before: any, after: any) {
  const diff: Record<string, { before: any; after: any }> = {};
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  for (const k of keys) {
    const b = before?.[k];
    const a = after?.[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) diff[k] = { before: b, after: a };
  }
  return diff;
}

/** Admin-only writes. Records an activity_log entry with actor + diff. */
export const saveSettingFn = createServerFn({ method: "POST" })
  .inputValidator((i) => Session.extend({
    key: z.string().min(1).max(100),
    value: z.record(z.string(), z.any()),
  }).parse(i))
  .handler(async ({ data }) => {
    const staff = await requireStaff(data.sessionId, ["admin"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Load previous value for diffing
    const { data: prev } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", data.key)
      .maybeSingle();
    const before = (prev?.value ?? {}) as any;

    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: data.key, value: data.value as any, updated_at: new Date().toISOString() });
    if (error) dbError(error);

    const diff = shallowDiff(before, data.value);
    const changedKeys = Object.keys(diff);
    await supabaseAdmin.from("activity_log").insert({
      action: "settings_updated",
      entity: "app_settings",
      entity_id: data.key,
      actor: `${staff.role}:${staff.staff_id}`,
      metadata: {
        setting_key: data.key,
        actor_name: staff.full_name,
        changed_keys: changedKeys,
        diff,
      } as any,
    });

    return { ok: true, changed: changedKeys.length };
  });
