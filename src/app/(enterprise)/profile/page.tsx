import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";
import { ProfileClient } from "@/components/profile-client";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fprofile");
  if (principal.roles.includes("SECURITY_STAFF")) return <ProfileClient />;
  return <main className="enterprise-main">
    <p className="eyebrow">Development identity</p>
    <h1>Profile</h1>
    <p className="enterprise-intro">Your current KSS Enterprise identity. Staff Personal Details are available only for an onboarding case you are authorised to manage.</p>
    <dl className="enterprise-profile">
      <div><dt>Display name</dt><dd>{principal.displayName}</dd></div>
      <div><dt>Active roles</dt><dd>{principal.roles.map((role) => role.replaceAll("_", " ")).join(", ")}</dd></div>
    </dl>
    <p className="enterprise-honesty">This page is read-only. Contact details do not change an authentication identity.</p>
  </main>;
}
