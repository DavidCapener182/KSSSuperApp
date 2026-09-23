import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { isUuid } from "@/lib/auth/principal";
import { publicDocument, readDocumentRequest } from "@/lib/documents/policy";

type CaseRow = { id: string; person_id: string; intended_role: string; site_id: string | null;
  template_version_id: string; owner_person_id: string; state: "DRAFT" | "IN_PROGRESS" | "CANCELLED";
  created_at: string; started_at: string | null; cancelled_at: string | null };
type RequirementRow = { id: string; case_id: string; definition_id: string; document_request_id: string | null };
type DefinitionRow = { id: string; code: string; title: string; position: number; mandatory: boolean;
  fulfilment_kind: string; provider_state: string; initial_actor: string };
type VerificationRow = { id: string; requirement_id: string; evidence_version_id: string;
  decided_at: string; synthetic_valid_until: string | null };

export function canUseOnboarding(principal: Principal) {
  return hasCapability(principal, "ONBOARDING_SELF_READ") || hasCapability(principal, "ONBOARDING_OFFICE_READ");
}
export function canManageOnboarding(principal: Principal, row: { person_id: string; owner_person_id: string }) {
  return principal.personId !== row.person_id &&
    (principal.roles.includes("SUPER_ADMIN") ||
      (principal.roles.includes("OFFICE_ADMIN") && row.owner_person_id === principal.personId));
}

export async function listOnboardingCases(client: SupabaseClient, principal: Principal) {
  if (!canUseOnboarding(principal)) return [];
  const { data, error } = await client.from("onboarding_cases")
    .select("id,person_id,intended_role,site_id,template_version_id,owner_person_id,state,created_at,started_at,cancelled_at")
    .order("created_at", { ascending: false }).limit(50).returns<CaseRow[]>();
  if (error) return null;
  const result = await Promise.all((data ?? []).map(async (row) => {
    if (!principal.roles.includes("SUPER_ADMIN") && row.person_id !== principal.personId && row.owner_person_id !== principal.personId) return null;
    const [{ data: person }, { data: site }] = await Promise.all([
      client.from("people").select("display_name").eq("id", row.person_id).maybeSingle<{ display_name: string }>(),
      row.site_id ? client.from("sites").select("name").eq("id", row.site_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
    ]);
    return { id: row.id, personId: row.person_id, starterName: person?.display_name ?? "Authorised starter",
      siteName: site?.name ?? "Company onboarding", intendedRole: row.intended_role,
      state: row.state, createdAt: row.created_at };
  }));
  return result.filter((row): row is NonNullable<typeof row> => row !== null);
}

export async function readOnboardingCase(client: SupabaseClient, principal: Principal, id: string) {
  if (!isUuid(id) || !canUseOnboarding(principal)) return null;
  const { data: c, error } = await client.from("onboarding_cases")
    .select("id,person_id,intended_role,site_id,template_version_id,owner_person_id,state,created_at,started_at,cancelled_at")
    .eq("id", id).maybeSingle<CaseRow>();
  if (error || !c || (!principal.roles.includes("SUPER_ADMIN") && c.person_id !== principal.personId && c.owner_person_id !== principal.personId)) return null;
  const { data: version } = await client.from("onboarding_template_versions")
    .select("version_number").eq("id", c.template_version_id).maybeSingle<{ version_number: number }>();
  const [{ data: person }, { data: site }, { data: instances, error: instancesError }] = await Promise.all([
    client.from("people").select("display_name").eq("id", c.person_id).maybeSingle<{ display_name: string }>(),
    c.site_id ? client.from("sites").select("name").eq("id", c.site_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
    client.from("onboarding_case_requirements").select("id,case_id,definition_id,document_request_id")
      .eq("case_id", c.id).returns<RequirementRow[]>(),
  ]);
  if (instancesError || !instances || instances.length !== 6 || !version) return null;
  const { data: definitions, error: definitionsError } = await client.from("onboarding_requirement_definitions")
    .select("id,code,title,position,mandatory,fulfilment_kind,provider_state,initial_actor")
    .in("id", instances.map((row) => row.definition_id)).returns<DefinitionRow[]>();
  const { data: verifications, error: verificationError } = await client.from("onboarding_requirement_verifications")
    .select("id,requirement_id,evidence_version_id,decided_at,synthetic_valid_until")
    .eq("case_id", c.id).returns<VerificationRow[]>();
  if (definitionsError || verificationError || !definitions || definitions.length !== 6) return null;
  const byDefinition = new Map(definitions.map((row) => [row.id, row]));
  const requirements = await Promise.all(instances.map(async (instance) => {
    const d = byDefinition.get(instance.definition_id);
    if (!d) return null;
    const verification = verifications?.find((row) => row.requirement_id === instance.id) ?? null;
    const source = instance.document_request_id ? await readDocumentRequest(client, instance.document_request_id) : null;
    if (instance.document_request_id && !source) return null;
    if (source && (source.request.target_person_id !== c.person_id || source.request.requester_person_id !== c.owner_person_id ||
      source.request.site_id !== c.site_id)) return null;
    const document = source ? publicDocument(source) : null;
    let state = "NOT_STARTED";
    let nextAction = "This requirement is not configured yet.";
    let actor = d.initial_actor;
    if (d.provider_state === "NOT_AVAILABLE") {
      state = "NOT_AVAILABLE"; nextAction = "Contract acknowledgement is not yet available in KSS Enterprise."; actor = "SYSTEM";
    } else if (d.provider_state === "NOT_CONNECTED") {
      state = "NOT_CONNECTED"; nextAction = "Training provider not connected — induction outstanding."; actor = "EXTERNAL_PROVIDER";
    } else if (d.provider_state === "NOT_CONFIGURED") {
      state = "NOT_CONFIGURED"; nextAction = d.code === "PERSONAL_DETAILS"
        ? "The starter profile process is not yet configured." : "This requirement is outstanding; its fulfilment process is not yet configured.";
      actor = "SYSTEM";
    } else if (d.code === "RIGHT_TO_WORK") {
      if (!document) { nextAction = "Office needs to issue a synthetic evidence request."; actor = "OFFICE"; }
      else if (document.workflowStatus === "REQUESTED") {
        state = "AWAITING_EVIDENCE"; nextAction = "Staff needs to submit synthetic evidence."; actor = "STAFF";
      } else if (document.workflowStatus === "REJECTED_ACTION_REQUIRED") {
        state = "ACTION_REQUIRED"; nextAction = "Staff needs to replace the rejected synthetic evidence."; actor = "STAFF";
      } else if (document.workflowStatus === "AWAITING_REVIEW") {
        state = "UNDER_REVIEW"; nextAction = "Office needs to review the submitted evidence."; actor = "OFFICE";
      } else if (document.workflowStatus === "ACCEPTED_AS_EVIDENCE") {
        state = "UNDER_REVIEW"; nextAction = "Office verification needed. Evidence acceptance alone is not verification."; actor = "OFFICE";
        if (verification && verification.evidence_version_id === document.version?.id) {
          const expired = verification.synthetic_valid_until && Date.parse(verification.synthetic_valid_until) <= Date.now();
          state = expired ? "EXPIRED" : "VERIFIED";
          nextAction = expired ? "Synthetic verification expired; a new authorised workflow is needed." : "Synthetic workflow verification recorded.";
          actor = expired ? "OFFICE" : "NONE";
        }
      }
    }
    return { id: instance.id, code: d.code, title: d.title, position: d.position, mandatory: d.mandatory,
      state, nextAction, actor, documentRequestId: instance.document_request_id,
      evidenceState: document?.workflowStatus ?? null,
      acceptedVersionId: document?.version?.review?.decision === "ACCEPTED_AS_EVIDENCE" ? document.version.id : null,
      feedback: document?.version?.review?.decision === "REJECTED" ? document.version.review.reviewer_comment : null,
      verifiedAt: state === "VERIFIED" ? verification?.decided_at ?? null : null,
      syntheticValidUntil: verification?.synthetic_valid_until ?? null };
  }));
  if (requirements.some((row) => row === null)) return null;
  const sorted = requirements.filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.position - b.position);
  return { id: c.id, personId: c.person_id, starterName: person?.display_name ?? "Authorised starter",
    ownerPersonId: c.owner_person_id, siteId: c.site_id, siteName: site?.name ?? "Company onboarding",
    intendedRole: c.intended_role, templateVersion: version.version_number, state: c.state,
    createdAt: c.created_at, startedAt: c.started_at, cancelledAt: c.cancelled_at,
    canManage: canManageOnboarding(principal, c), verifiedCount: sorted.filter((row) => row.state === "VERIFIED").length,
    totalCount: sorted.length, requirements: sorted };
}
