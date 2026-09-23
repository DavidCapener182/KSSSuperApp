import { getPrincipal } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { PROFILE_FIELDS, profileInputErrors, readOwnProfile } from "@/lib/profile/policy";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const data = await readOwnProfile(client, principal);
  return data ? privateJson(data) : privateJson({ error: "Profile unavailable" }, 503);
}

export async function PUT(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
  const body = await request.json().catch(() => null);
  const errors = profileInputErrors(body);
  if (Object.keys(errors).length) return privateJson({ error: "Check Personal Details", fields: errors }, 400);
  const values = body as Record<string, string | null | undefined>;
  const fields = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, values[field] ?? null]));
  const { error } = await client.rpc("save_person_profile", {
    supplied_first: fields.legal_first_name, supplied_surname: fields.surname,
    supplied_preferred: fields.preferred_name, supplied_email: fields.contact_email,
    supplied_mobile: fields.mobile, supplied_address1: fields.address_line1,
    supplied_address2: fields.address_line2, supplied_town: fields.town_city,
    supplied_postcode: fields.postcode,
  });
  return error ? privateJson({ error: "Personal Details could not be saved" }, 400) : privateJson({ saved: true });
}
