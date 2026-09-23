import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { canManageStaffing } from "@/lib/events/staffing";

export async function GET() {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised(); if (!canManageStaffing(principal.roles)) return forbidden();
  const { data, error } = await client.rpc("staffing_role_choices");
  return error ? privateJson({ error: "Operational roles unavailable" }, 503) : privateJson({ roles: data });
}
