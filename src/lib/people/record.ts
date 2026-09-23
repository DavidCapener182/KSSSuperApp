import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { readDocumentRequest } from "@/lib/documents/policy";
import { readOnboardingCase } from "@/lib/onboarding/policy";
import { readOwnProfile, type Profile, type ProfileRevision } from "@/lib/profile/policy";

type Case = NonNullable<Awaited<ReturnType<typeof readOnboardingCase>>>;
type DocumentSummary = { id: string; title: string; status: string };
type SiteSummary = { name: string; from: string; until: string | null; ended: boolean };

export type StaffRecordSections = {
  cases: Case[];
  profile: Profile | null;
  submittedProfile: ProfileRevision | null;
  documents: DocumentSummary[] | null;
  sites: SiteSummary[] | null;
  canReadPrivate: boolean;
};

export async function readStaffRecordSections(client: SupabaseClient, principal: Principal,
  personId: string, currentCaseId: string | null): Promise<StaffRecordSections> {
  const self = principal.personId === personId;
  const operationsOnly = principal.roles.includes("OPERATIONS") &&
    !principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN") && !self;
  if (operationsOnly) return { cases: [], profile: null, submittedProfile: null,
    documents: null, sites: null, canReadPrivate: false };

  const listed = await client.from("onboarding_cases")
    .select("id,state,template_version_id,created_at").eq("person_id", personId)
    .order("created_at", { ascending: false }).limit(100);
  const eligible = listed.error ? [] : listed.data ?? [];
  const templateIds = [...new Set(eligible.map((row) => row.template_version_id))];
  const templateVersions = templateIds.length
    ? await client.from("onboarding_template_versions").select("id,version_number").in("id", templateIds)
    : { data: [], error: null };
  const versionById = new Map((templateVersions.data ?? []).map((row) => [row.id, row.version_number]));
  const ids = [...new Set([
    currentCaseId ?? eligible.find((row) => row.state === "IN_PROGRESS")?.id,
    eligible.find((row) => versionById.get(row.template_version_id) === 1)?.id,
    eligible.find((row) => row.state === "CANCELLED")?.id,
    ...eligible.map((row) => row.id),
  ].filter((id): id is string => Boolean(id)))].slice(0, 3);
  const cases = (await Promise.all(ids.map((id) => readOnboardingCase(client, principal, id))))
    .filter((row): row is Case => Boolean(row && row.personId === personId))
    .sort((a, b) => Number(b.state === "IN_PROGRESS") - Number(a.state === "IN_PROGRESS") ||
      Number(b.state === "DRAFT") - Number(a.state === "DRAFT") ||
      Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const canReadPrivate = self || cases.length > 0;
  if (!canReadPrivate) return { cases: [], profile: null, submittedProfile: null,
    documents: null, sites: null, canReadPrivate: false };

  const own = self && principal.roles.includes("SECURITY_STAFF") ? await readOwnProfile(client, principal) : null;
  const primary = cases.find((row) => row.state === "IN_PROGRESS") ?? cases[0] ?? null;
  const profile = own?.profile ?? primary?.profile ?? null;
  const submittedProfile = cases.map((row) => row.submittedProfile).filter((row): row is ProfileRevision => Boolean(row))
    .sort((a, b) => Date.parse(b.submitted_at) - Date.parse(a.submitted_at))[0] ?? null;

  const requestIds = [...new Set(cases.flatMap((row) => row.requirements
    .map((requirement) => requirement.documentRequestId).filter((id): id is string => Boolean(id))))].slice(0, 12);
  const [ownRequests, linkedRequests, assignments] = await Promise.all([
    self ? client.from("document_requests").select("id,title,status")
      .eq("target_person_id", personId).order("created_at", { ascending: false }).limit(4)
      : Promise.resolve({ data: [], error: null }),
    !self && requestIds.length ? Promise.all(requestIds.map((id) => readDocumentRequest(client, id)))
      : Promise.resolve([]),
    client.from("site_assignments").select("site_id,effective_from,effective_until,revoked_at")
      .eq("person_id", personId).order("effective_from", { ascending: false }).limit(4),
  ]);
  const documents: DocumentSummary[] = self
    ? (ownRequests.error ? [] : (ownRequests.data ?? []).map((row) => ({ id: row.id, title: row.title, status: row.status })))
    : linkedRequests.filter((row): row is NonNullable<typeof row> => Boolean(row && row.request.target_person_id === personId))
      .map((row) => ({ id: row.request.id, title: row.request.title, status: row.request.status }));
  const readableAssignments = assignments.error ? [] : assignments.data ?? [];
  const siteIds = [...new Set(readableAssignments.map((row) => row.site_id))];
  const siteResult = siteIds.length ? await client.from("sites").select("id,name").in("id", siteIds)
    : { data: [], error: null };
  const siteNames = new Map((siteResult.data ?? []).map((row) => [row.id, row.name]));
  const sites = readableAssignments.flatMap((row) => {
    const name = siteNames.get(row.site_id);
    return name ? [{ name, from: row.effective_from, until: row.effective_until,
      ended: Boolean(row.revoked_at || (row.effective_until && Date.parse(row.effective_until) <= Date.now())) }] : [];
  });
  return { cases, profile, submittedProfile, documents, sites, canReadPrivate };
}
