import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type StaffRole = "admin" | "manager" | "technician" | "reception" | "guardian" | "partner";

export type StaffSessionRow = {
  session_id: string;
  staff_id: string;
  full_name: string;
  role: StaffRole;
  must_change_pin: boolean;
  last_login_at: string | null;
};

/** Validates a staff session id and returns the row, or throws Unauthorized. */
export async function requireStaff(
  sessionId: string | undefined | null,
  allowedRoles?: StaffRole[],
): Promise<StaffSessionRow> {
  if (!sessionId) throw new Error("Unauthorized");
  const { data, error } = await supabaseAdmin.rpc("get_staff_session", { p_session: sessionId });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as StaffSessionRow | undefined;
  if (!row) throw new Error("Unauthorized");
  if (allowedRoles && !allowedRoles.includes(row.role)) throw new Error("Forbidden");
  return row;
}
