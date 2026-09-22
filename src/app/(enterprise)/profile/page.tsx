import { redirect } from "next/navigation";
import { getPrincipal } from "@/lib/auth/principal";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const principal = await getPrincipal(await createServerSupabase());
  if (!principal) redirect("/?next=%2Fprofile");
  return <main className="enterprise-main">
    <p className="eyebrow">Development identity</p>
    <h1>Profile</h1>
    <p className="enterprise-intro">Your current KSS Enterprise identity.</p>
    <dl className="enterprise-profile">
      <div><dt>Display name</dt><dd>{principal.displayName}</dd></div>
      <div><dt>Person ID</dt><dd className="enterprise-id">{principal.personId}</dd></div>
      <div><dt>Active roles</dt><dd>{principal.roles.map((role) => role.replaceAll("_", " ")).join(", ")}</dd></div>
    </dl>
    <p className="enterprise-honesty">This page is read-only. Authentication identities remain separate from your Person ID.</p>
  </main>;
}
