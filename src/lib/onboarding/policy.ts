import type { SupabaseClient } from "@supabase/supabase-js";
import type { Principal } from "@/lib/auth/principal";
import { hasCapability } from "@/lib/auth/capabilities";
import { isUuid } from "@/lib/auth/principal";
import { publicDocument, readDocumentRequest } from "@/lib/documents/policy";
import { profileReady, requiredProfileMatches, siaCurrentMatches, siaExpired,
  type Profile, type ProfileRevision, type SiaCredential, type SiaRevision } from "@/lib/profile/policy";

type CaseRow = { id: string; person_id: string; intended_role: string; site_id: string | null;
  template_version_id: string; owner_person_id: string; state: "DRAFT" | "IN_PROGRESS" | "CANCELLED";
  created_at: string; started_at: string | null; cancelled_at: string | null };
type RequirementRow = { id: string; case_id: string; definition_id: string; document_request_id: string | null };
type DefinitionRow = { id: string; code: string; title: string; position: number; mandatory: boolean;
  fulfilment_kind: string; provider_state: string; initial_actor: string; expected_sia_category: string | null };
type VerificationRow = { id: string; requirement_id: string; evidence_version_id: string;
  decided_at: string; synthetic_valid_until: string | null; sia_submission_id: string | null };
type ProfileSubmission = { id: string; requirement_id: string; revision_id: string; submitted_at: string };
type SiaSubmission = { id: string; requirement_id: string; revision_id: string;
  document_request_id: string | null; submitted_at: string };
type ControlledAssignment = { id: string; requirement_id: string; target_person_id: string;
  document_id: string; version_id: string; assigned_at: string };
type ControlledVersion = { id: string; document_id: string; title: string; version_number: number;
  state: string; published_at: string | null; effective_on: string | null; scan_state: string };
type ControlledAccess = { id: string; assignment_id: string; person_id: string; version_id: string; accessed_at: string };
type ControlledAcknowledgement = { id: string; assignment_id: string; actor_person_id: string;
  version_id: string; acknowledged_at: string };

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
    const [{ data: person }, { data: site }, { data: version }, { data: profileName }] = await Promise.all([
      client.from("people").select("display_name").eq("id", row.person_id).maybeSingle<{ display_name: string }>(),
      row.site_id ? client.from("sites").select("name").eq("id", row.site_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
      client.from("onboarding_template_versions").select("version_number").eq("id", row.template_version_id)
        .maybeSingle<{ version_number: number }>(),
      row.state !== "CANCELLED"
        ? client.from("person_profiles").select("legal_first_name,surname").eq("person_id", row.person_id)
          .maybeSingle<{ legal_first_name: string | null; surname: string | null }>()
        : Promise.resolve({ data: null }),
    ]);
    const legalName = [profileName?.legal_first_name, profileName?.surname].filter(Boolean).join(" ");
    return { id: row.id, personId: row.person_id, starterName: (person?.display_name ?? legalName) || "Authorised starter",
      siteName: site?.name ?? "Company onboarding", intendedRole: row.intended_role,
      templateVersion: version?.version_number ?? null, state: row.state, createdAt: row.created_at };
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
  if (!version) return null;
  const superPrivate = principal.roles.includes("SUPER_ADMIN") && version.version_number >= 2
    ? await client.rpc("read_onboarding_private_profile", { requested_case: c.id }) : null;
  if (superPrivate?.error) return null;
  const superValues = superPrivate?.data as {
    profile: Profile | null; submittedProfile: ProfileRevision | null;
    siaCredential: SiaCredential | null; submittedSia: SiaRevision | null;
  } | null;
  const [{ data: person }, { data: site }, { data: instances, error: instancesError }] = await Promise.all([
    client.from("people").select("display_name").eq("id", c.person_id).maybeSingle<{ display_name: string }>(),
    c.site_id ? client.from("sites").select("name").eq("id", c.site_id).maybeSingle<{ name: string }>() : Promise.resolve({ data: null }),
    client.from("onboarding_case_requirements").select("id,case_id,definition_id,document_request_id")
      .eq("case_id", c.id).returns<RequirementRow[]>(),
  ]);
  if (instancesError || !instances || instances.length !== 6 || !version) return null;
  const { data: definitions, error: definitionsError } = await client.from("onboarding_requirement_definitions")
    .select("id,code,title,position,mandatory,fulfilment_kind,provider_state,initial_actor,expected_sia_category")
    .in("id", instances.map((row) => row.definition_id)).returns<DefinitionRow[]>();
  const [verificationResult, profileResult, profileSubmissionResult, siaResult, siaSubmissionResult,
    controlledAssignmentResult] = await Promise.all([
    client.from("onboarding_requirement_verifications")
      .select("id,requirement_id,evidence_version_id,decided_at,synthetic_valid_until,sia_submission_id")
      .eq("case_id", c.id).returns<VerificationRow[]>(),
    version.version_number >= 2 && c.state !== "CANCELLED" && !superValues
      ? client.from("person_profiles").select("*").eq("person_id", c.person_id).maybeSingle<Profile>()
      : Promise.resolve({ data: null, error: null }),
    client.from("onboarding_profile_submissions").select("id,requirement_id,revision_id,submitted_at")
      .eq("case_id", c.id).order("submitted_at", { ascending: false }).order("id", { ascending: false })
      .returns<ProfileSubmission[]>(),
    version.version_number >= 2 && c.state !== "CANCELLED" && !superValues
      ? client.from("person_sia_credentials").select("*").eq("person_id", c.person_id)
        .eq("category", "SECURITY_GUARDING").maybeSingle<SiaCredential>()
      : Promise.resolve({ data: null, error: null }),
    client.from("onboarding_sia_submissions").select("id,requirement_id,revision_id,document_request_id,submitted_at")
      .eq("case_id", c.id).order("submitted_at", { ascending: false }).order("id", { ascending: false })
      .returns<SiaSubmission[]>(),
    client.from("onboarding_controlled_assignments")
      .select("id,requirement_id,target_person_id,document_id,version_id,assigned_at")
      .eq("case_id", c.id).returns<ControlledAssignment[]>(),
  ]);
  if (definitionsError || verificationResult.error || profileResult.error || profileSubmissionResult.error ||
    siaResult.error || siaSubmissionResult.error || controlledAssignmentResult.error ||
    !definitions || definitions.length !== 6) return null;
  const verifications = verificationResult.data;
  const profile = superValues?.profile ?? profileResult.data;
  const siaCredential = superValues?.siaCredential ?? siaResult.data;
  const profileSubmission = profileSubmissionResult.data?.[0] ?? null;
  const siaSubmission = siaSubmissionResult.data?.[0] ?? null;
  const [profileRevisionResult, siaRevisionResult] = await Promise.all([
    profileSubmission && !superValues ? client.from("person_profile_revisions").select("*").eq("id", profileSubmission.revision_id)
      .maybeSingle<ProfileRevision>() : Promise.resolve({ data: null, error: null }),
    siaSubmission && !superValues ? client.from("person_sia_credential_revisions").select("*").eq("id", siaSubmission.revision_id)
      .maybeSingle<SiaRevision>() : Promise.resolve({ data: null, error: null }),
  ]);
  const profileRevision = superValues?.submittedProfile ?? profileRevisionResult.data;
  const siaRevision = superValues?.submittedSia ?? siaRevisionResult.data;
  if (profileRevisionResult.error || siaRevisionResult.error ||
    (profileSubmission && !profileRevision) || (siaSubmission && !siaRevision)) return null;
  const controlledAssignment = controlledAssignmentResult.data?.[0] ?? null;
  const [controlledVersionResult, controlledAccessResult, controlledAckResult] = await Promise.all([
    controlledAssignment ? client.from("controlled_document_versions")
      .select("id,document_id,title,version_number,state,published_at,effective_on,scan_state")
      .eq("id", controlledAssignment.version_id).maybeSingle<ControlledVersion>()
      : Promise.resolve({ data: null, error: null }),
    controlledAssignment ? client.from("controlled_document_accesses")
      .select("id,assignment_id,person_id,version_id,accessed_at")
      .eq("assignment_id", controlledAssignment.id).order("accessed_at", { ascending: false }).limit(1)
      .returns<ControlledAccess[]>() : Promise.resolve({ data: null, error: null }),
    controlledAssignment ? client.from("controlled_acknowledgements")
      .select("id,assignment_id,actor_person_id,version_id,acknowledged_at")
      .eq("assignment_id", controlledAssignment.id).maybeSingle<ControlledAcknowledgement>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (controlledVersionResult.error || controlledAccessResult.error || controlledAckResult.error ||
    (controlledAssignment && !controlledVersionResult.data)) return null;
  const controlledVersion = controlledVersionResult.data;
  const controlledAccess = controlledAccessResult.data?.[0] ?? null;
  const controlledAck = controlledAckResult.data;
  const byDefinition = new Map(definitions.map((row) => [row.id, row]));
  const requirements = await Promise.all(instances.map(async (instance) => {
    const d = byDefinition.get(instance.definition_id);
    if (!d) return null;
    const verification = verifications?.find((row) => row.requirement_id === instance.id &&
      (d.code !== "SIA_LICENCE" || row.sia_submission_id === siaSubmission?.id)) ?? null;
    const requestId = d.code === "SIA_LICENCE" ? siaSubmission?.document_request_id ?? null : instance.document_request_id;
    const source = requestId ? await readDocumentRequest(client, requestId) : null;
    if (requestId && !source) return null;
    if (source && (source.request.target_person_id !== c.person_id || source.request.requester_person_id !== c.owner_person_id ||
      source.request.site_id !== c.site_id)) return null;
    const document = source ? publicDocument(source) : null;
    let state = "NOT_STARTED";
    let nextAction = "This requirement is not configured yet.";
    let actor = d.initial_actor;
    const assignedContract = d.code === "CONTRACT_TERMS" && d.fulfilment_kind === "CONTROLLED_ACKNOWLEDGEMENT"
      && controlledAssignment?.requirement_id === instance.id && controlledAssignment.target_person_id === c.person_id
      && controlledVersion?.id === controlledAssignment.version_id
      && controlledVersion.document_id === controlledAssignment.document_id;
    if (assignedContract) {
      if (controlledAck?.assignment_id === controlledAssignment.id &&
        controlledAck.actor_person_id === c.person_id && controlledAck.version_id === controlledVersion.id &&
        controlledAccess?.assignment_id === controlledAssignment.id) {
        state = "ACKNOWLEDGED"; nextAction = "This exact synthetic document version was acknowledged. No signature or proof of reading is recorded.";
        actor = "NONE";
      } else if (controlledAccess?.assignment_id === controlledAssignment.id) {
        state = "AWAITING_ACKNOWLEDGEMENT";
        nextAction = "Document accessed. Confirm acknowledgement of this exact version when ready.";
        actor = "STAFF";
      } else {
        state = "AWAITING_DOCUMENT_ACCESS";
        nextAction = "Open this exact synthetic document version, then explicitly acknowledge it.";
        actor = "STAFF";
      }
    } else if (d.provider_state === "NOT_AVAILABLE") {
      state = "NOT_AVAILABLE"; nextAction = "Contract acknowledgement is not yet available in KSS Enterprise."; actor = "SYSTEM";
    } else if (d.provider_state === "NOT_CONNECTED") {
      state = "NOT_CONNECTED"; nextAction = "Training provider not connected — induction outstanding."; actor = "EXTERNAL_PROVIDER";
    } else if (d.provider_state === "NOT_CONFIGURED") {
      state = "NOT_CONFIGURED"; nextAction = d.code === "PERSONAL_DETAILS"
        ? "The starter profile process is not yet configured." : "This requirement is outstanding; its fulfilment process is not yet configured.";
      actor = "SYSTEM";
    } else if (d.code === "PERSONAL_DETAILS") {
      actor = "STAFF";
      if (!profileReady(profile)) {
        state = "ACTION_REQUIRED"; nextAction = "Complete the required Personal Details in Profile, then submit this case.";
      } else if (!profileSubmission) {
        state = "AWAITING_SUBMISSION"; nextAction = "Personal Details are saved. Submit them for this onboarding case.";
      } else if (!requiredProfileMatches(profile, profileRevision)) {
        state = "UPDATE_NEEDS_SUBMISSION"; nextAction = "Required details changed. Resubmit the current Profile to restore completion.";
      } else {
        state = "COMPLETE"; nextAction = "Personal Details self-submitted. Formatting was checked; identity was not verified.";
        actor = "NONE";
      }
    } else if (d.code === "SIA_LICENCE") {
      actor = "STAFF";
      if (!siaCredential?.synthetic_reference || !siaCredential.expires_on) {
        state = "ACTION_REQUIRED"; nextAction = "Enter synthetic Security Guarding details in Profile.";
      } else if (!siaSubmission) {
        state = "AWAITING_SUBMISSION"; nextAction = "Synthetic SIA details are saved. Submit them for this case.";
      } else if (!siaCurrentMatches(siaCredential, siaRevision)) {
        state = "UPDATE_NEEDS_SUBMISSION"; nextAction = "Synthetic SIA details changed. Submit a new credential revision.";
      } else if (siaExpired(siaRevision?.expires_on ?? null)) {
        state = "EXPIRED"; nextAction = "Synthetic SIA expiry date has passed. Submit new details and evidence.";
      } else if (!document) {
        state = "AWAITING_EVIDENCE_REQUEST"; nextAction = "Office needs to issue a protected SIA evidence request."; actor = "OFFICE";
      } else if (document.workflowStatus === "REQUESTED") {
        state = "AWAITING_EVIDENCE"; nextAction = "Submit synthetic SIA evidence in the protected Documents area.";
      } else if (document.workflowStatus === "REJECTED_ACTION_REQUIRED") {
        state = "ACTION_REQUIRED"; nextAction = "Replace the rejected synthetic SIA evidence.";
      } else if (document.workflowStatus === "AWAITING_REVIEW") {
        state = "UNDER_REVIEW"; nextAction = "Office needs to review the submitted SIA evidence."; actor = "OFFICE";
      } else if (document.workflowStatus === "ACCEPTED_AS_EVIDENCE") {
        state = "UNDER_REVIEW"; nextAction = "Office verification needed. Evidence acceptance did not verify SIA."; actor = "OFFICE";
        if (verification && verification.evidence_version_id === document.version?.id) {
          state = "VERIFIED"; nextAction = "Synthetic SIA workflow verification recorded. No register check was made."; actor = "NONE";
        }
      }
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
      state, nextAction, actor, documentRequestId: requestId,
      evidenceState: document?.workflowStatus ?? null,
      acceptedVersionId: document?.version?.review?.decision === "ACCEPTED_AS_EVIDENCE" ? document.version.id : null,
      feedback: document?.version?.review?.decision === "REJECTED" ? document.version.review.reviewer_comment : null,
      verifiedAt: state === "VERIFIED" ? verification?.decided_at ?? null : null,
      syntheticValidUntil: verification?.synthetic_valid_until ?? null,
      profileSubmissionId: d.code === "PERSONAL_DETAILS" ? profileSubmission?.id ?? null : null,
      siaSubmissionId: d.code === "SIA_LICENCE" ? siaSubmission?.id ?? null : null,
      controlled: assignedContract && controlledAssignment && controlledVersion ? {
        assignmentId: controlledAssignment.id, documentId: controlledAssignment.document_id,
        versionId: controlledVersion.id, title: controlledVersion.title,
        versionNumber: controlledVersion.version_number, publishedAt: controlledVersion.published_at,
        effectiveOn: controlledVersion.effective_on, scanState: controlledVersion.scan_state,
        accessedAt: controlledAccess?.accessed_at ?? null, acknowledgedAt: controlledAck?.acknowledged_at ?? null,
        acknowledgedBy: controlledAck?.actor_person_id ?? null,
      } : null,
      expectedSiaCategory: d.expected_sia_category };
  }));
  if (requirements.some((row) => row === null)) return null;
  const sorted = requirements.filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => a.position - b.position);
  const legalName = [profile?.legal_first_name ?? profileRevision?.legal_first_name,
    profile?.surname ?? profileRevision?.surname].filter(Boolean).join(" ");
  return { id: c.id, personId: c.person_id, starterName: (person?.display_name ?? legalName) || "Authorised starter",
    ownerPersonId: c.owner_person_id, siteId: c.site_id, siteName: site?.name ?? "Company onboarding",
    intendedRole: c.intended_role, templateVersion: version.version_number, state: c.state,
    createdAt: c.created_at, startedAt: c.started_at, cancelledAt: c.cancelled_at,
    canManage: canManageOnboarding(principal, c), verifiedCount: sorted.filter((row) =>
      row.state === "VERIFIED" || row.state === "COMPLETE" || row.state === "ACKNOWLEDGED").length,
    totalCount: sorted.length, requirements: sorted,
    profile, submittedProfile: profileRevision, profileSubmittedAt: profileSubmission?.submitted_at ?? null,
    siaCredential, submittedSia: siaRevision, siaSubmittedAt: siaSubmission?.submitted_at ?? null };
}
