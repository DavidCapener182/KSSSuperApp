import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase(); const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.some((role) => ["SUPER_ADMIN","OFFICE_ADMIN","OPERATIONS"].includes(role))) return forbidden();
  const [clients, sites, owners] = await Promise.all([client.rpc("operational_client_choices"), client.rpc("operational_sites", { p_limit: 50 }), client.rpc("operational_owner_choices")]);
  if (clients.error || sites.error || owners.error) return privateJson({ error: "Operational choices unavailable" }, 503);
  return privateJson({ clients: clients.data, sites: sites.data?.items ?? [], owners: owners.data });
}
