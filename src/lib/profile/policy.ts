import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";

export const SIA_CATEGORIES = ["SECURITY_GUARDING", "DOOR_SUPERVISION", "PUBLIC_SPACE_SURVEILLANCE_CCTV"] as const;
export type SiaCategory = (typeof SIA_CATEGORIES)[number];
export const SIA_LABELS: Record<SiaCategory, string> = {
  SECURITY_GUARDING: "Security Guarding",
  DOOR_SUPERVISION: "Door Supervisor",
  PUBLIC_SPACE_SURVEILLANCE_CCTV: "Public Space Surveillance (CCTV)",
};
export const PROFILE_FIELDS = ["legal_first_name", "surname", "preferred_name", "contact_email", "mobile",
  "address_line1", "address_line2", "town_city", "postcode"] as const;
export const REQUIRED_PROFILE_FIELDS = ["legal_first_name", "surname", "contact_email", "mobile",
  "address_line1", "town_city", "postcode"] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type Profile = { person_id: string; updated_at: string; required_change_seq: number } & Record<ProfileField, string | null>;
export type ProfileRevision = { id: string; person_id: string; submitted_at: string;
  changed_fields: string[]; required_change_seq: number } & Record<ProfileField, string | null>;
export type SiaCredential = { id: string; person_id: string; category: SiaCategory;
  synthetic_reference: string | null; expires_on: string | null; updated_at: string; credential_change_seq: number };
export type SiaRevision = { id: string; credential_id: string; person_id: string;
  category: SiaCategory; synthetic_reference: string; expires_on: string; submitted_at: string; credential_change_seq: number };

export function requiredProfileMatches(current: Profile | null, submitted: ProfileRevision | null) {
  return Boolean(current && submitted && current.required_change_seq === submitted.required_change_seq &&
    REQUIRED_PROFILE_FIELDS.every((field) => current[field] === submitted[field]));
}
export function profileReady(current: Profile | null) {
  return Boolean(current && REQUIRED_PROFILE_FIELDS.every((field) => current[field]?.trim()));
}
export function londonToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function siaExpired(expiresOn: string | null, asOf = londonToday()) {
  return Boolean(expiresOn && expiresOn < asOf);
}
export function siaCurrentMatches(current: SiaCredential | null, submitted: SiaRevision | null) {
  return Boolean(current && submitted && current.id === submitted.credential_id &&
    current.credential_change_seq === submitted.credential_change_seq &&
    current.category === submitted.category && current.synthetic_reference === submitted.synthetic_reference &&
    current.expires_on === submitted.expires_on);
}
export function profileInputErrors(input: unknown): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object") return { form: "Enter Personal Details." };
  const values = input as Record<string, unknown>;
  const limits: Record<ProfileField, number> = { legal_first_name: 80, surname: 80, preferred_name: 80,
    contact_email: 254, mobile: 24, address_line1: 160, address_line2: 160, town_city: 100, postcode: 12 };
  for (const field of PROFILE_FIELDS) {
    const value = values[field];
    if (value !== null && value !== undefined && typeof value !== "string") errors[field] = "Enter text.";
    else if (typeof value === "string" && (value.trim().length > limits[field] || /[\x00-\x1f\x7f]/.test(value)))
      errors[field] = "Check the length and remove control characters.";
  }
  const email = String(values.contact_email ?? "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.contact_email = "Enter a valid email format.";
  const mobile = String(values.mobile ?? "").trim();
  if (mobile && !/^[+]?[0-9 ()-]{7,24}$/.test(mobile)) errors.mobile = "Enter a mobile number using digits and optional +, spaces or hyphens.";
  const postcode = String(values.postcode ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  if (postcode && !/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/.test(postcode)) errors.postcode = "Enter a UK postcode format.";
  return errors;
}
export async function readOwnProfile(client: SupabaseClient, principal: Principal) {
  if (!principal.roles.includes("SECURITY_STAFF")) return null;
  const [profile, credentials, auth] = await Promise.all([
    client.from("person_profiles").select("*").eq("person_id", principal.personId).maybeSingle<Profile>(),
    client.from("person_sia_credentials").select("*").eq("person_id", principal.personId).returns<SiaCredential[]>(),
    client.auth.getUser(),
  ]);
  if (profile.error || credentials.error) return null;
  return { profile: profile.data, credentials: credentials.data ?? [], signInEmail: auth.data.user?.email ?? null };
}
