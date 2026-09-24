import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { forbidden, privateJson, unauthorised } from "@/lib/auth/responses";
import { createServerSupabase } from "@/lib/supabase/server";
import { SIA_CATEGORIES } from "@/lib/profile/policy";

const METHODS = new Set(["OFFICE_CHECKED_EVIDENCE"]);
const REASONS = new Set(["EVIDENCE_MISMATCH", "UNREADABLE", "EXPIRED", "CORRECTION", "OTHER"]);
const date = (value: unknown) => value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)));

export async function GET(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const url = new URL(request.url);
  if (url.searchParams.get("queue") === "1") {
    if (!principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN")) return forbidden();
    const { data, error } = await client.rpc("credential_review_queue_16b");
    return error ? privateJson({ error: "Queue unavailable" }, 500) : privateJson({ queue: data ?? [] });
  }
  const requestedPerson = url.searchParams.get("personId") ?? principal.personId;
  if (!isUuid(requestedPerson)) return privateJson({ error: "Invalid person" }, 400);
  const self = requestedPerson === principal.personId && principal.roles.includes("SECURITY_STAFF");
  if (!self && !principal.roles.some((role) => role === "SUPER_ADMIN" || role === "OFFICE_ADMIN")) return forbidden();
  if (principal.roles.includes("SUPER_ADMIN") && !self) {
    const { data, error } = await client.rpc("read_credential_oversight_16b", { subject: requestedPerson });
    if (error || !data) return privateJson({ error: "Credential oversight denied" }, 403);
    const snapshot = data as { claims: unknown[]; revisions: unknown[]; decisions: unknown[]; grants: unknown[] };
    return privateJson({ claims: snapshot.claims, revisions: snapshot.revisions,
      decisions: snapshot.decisions, grants: snapshot.grants, documents: [], synthetic: true });
  }
  const [claims, revisions, decisions, grants, documents] = await Promise.all([
    client.from("credential_claims_16b").select("id,person_id,type_code,draft_reference,draft_issued_on,draft_expires_on,draft_change_seq,latest_revision_id,withdrawn_at,updated_at").eq("person_id", requestedPerson),
    client.from("credential_revisions_16b").select("id,claim_id,type_code,type_version,revision_number,synthetic_reference,issued_on,expires_on,draft_change_seq,evidence_version_id,evidence_sha256,submitted_at").eq("person_id", requestedPerson).order("submitted_at", { ascending: false }),
    client.from("credential_decisions_16b").select("id,claim_id,revision_id,decision,method,reason_code,decided_at"),
    client.from("credential_reviewer_grants_16b").select("id,reviewer_person_id,subject_person_id,type_code,effective_until,revoked_at").eq("subject_person_id", requestedPerson),
    self ? client.from("document_requests").select("id,title,status,created_at")
      .eq("target_person_id", requestedPerson).like("title", "Synthetic credential evidence: %")
      : client.from("document_requests").select("id,title,status,created_at")
      .eq("target_person_id", requestedPerson).eq("requester_person_id", principal.personId)
      .like("title", "Synthetic credential evidence: %"),
  ]);
  if (claims.error || revisions.error || decisions.error || grants.error || documents.error) return privateJson({ error: "Credentials unavailable" }, 500);
  const visibleClaims = claims.data ?? [];
  const claimIds = new Set(visibleClaims.map((item) => item.id));
  const visibleRevisions = (revisions.data ?? []).filter((item) => claimIds.has(item.claim_id));
  const revisionIds = new Set(visibleRevisions.map((item) => item.id));
  const visibleDecisions = (decisions.data ?? []).filter((item) => revisionIds.has(item.revision_id));
  const visibleGrants = (grants.data ?? []).filter((item) => principal.roles.includes("SUPER_ADMIN") || item.reviewer_person_id === principal.personId);
  // Document metadata is limited to own Requests. The normal Documents route owns exact file access.
  return privateJson({ claims: visibleClaims, revisions: visibleRevisions, decisions: visibleDecisions,
    grants: visibleGrants, documents: documents.data ?? [], synthetic: true });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  const principal = await getPrincipal(client);
  if (!principal) return unauthorised();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return privateJson({ error: "Invalid action" }, 400);
  const category = body.category;
  if (body.action === "save") {
    if (!principal.roles.includes("SECURITY_STAFF")) return forbidden();
    if (!SIA_CATEGORIES.includes(category) || typeof body.reference !== "string" ||
      !/^SYN-SIA-[A-Z0-9-]{3,40}$/.test(body.reference.trim().toUpperCase()) ||
      !date(body.issuedOn ?? null) || !date(body.expiresOn ?? null) ||
      (body.issuedOn && body.expiresOn && body.issuedOn > body.expiresOn)) return privateJson({ error: "Invalid synthetic credential" }, 400);
    const { data, error } = await client.rpc("save_credential_draft_16b", {
      category, supplied_reference: body.reference.trim().toUpperCase(), supplied_issue: body.issuedOn || null, supplied_expiry: body.expiresOn || null,
    });
    return error ? privateJson({ error: "Draft denied" }, 409) : privateJson({ id: data }, 201);
  }
  if (body.action === "submit" || body.action === "withdraw") {
    if (!principal.roles.includes("SECURITY_STAFF") || !isUuid(body.claimId) ||
      (body.action === "submit" && !isUuid(body.versionId))) return forbidden();
    const { data, error } = body.action === "submit"
      ? await client.rpc("submit_credential_16b", { requested_claim: body.claimId, requested_version: body.versionId })
      : await client.rpc("withdraw_credential_16b", { requested_claim: body.claimId });
    return error ? privateJson({ error: "Credential action denied" }, 409) : privateJson({ id: data ?? body.claimId }, 201);
  }
  if (body.action === "decide") {
    if (!principal.roles.some((role) => role === "OFFICE_ADMIN" || role === "SUPER_ADMIN") || !isUuid(body.revisionId) ||
      !["VERIFIED", "REJECTED", "REVOKED"].includes(body.decision) || !METHODS.has(body.method) ||
      (body.decision !== "VERIFIED" && !REASONS.has(body.reasonCode)) ||
      (body.decision === "VERIFIED" && (body.method !== "OFFICE_CHECKED_EVIDENCE" || body.reasonCode))) return forbidden();
    const { data, error } = await client.rpc("decide_credential_16b", {
      requested_revision: body.revisionId, supplied_decision: body.decision,
      supplied_method: body.method, supplied_reason: body.reasonCode ?? null,
    });
    return error ? privateJson({ error: "Decision denied or stale" }, 409) : privateJson({ id: data }, 201);
  }
  if (body.action === "requestEvidence") {
    if (!principal.roles.includes("OFFICE_ADMIN") || !isUuid(body.personId) || !SIA_CATEGORIES.includes(category)) return forbidden();
    const { data, error } = await client.rpc("request_credential_evidence_16b", { subject: body.personId, category });
    return error ? privateJson({ error: "Evidence request denied" }, 409) : privateJson({ id: data }, 201);
  }
  if (body.action === "grant") {
    if (!principal.roles.includes("SUPER_ADMIN") || !isUuid(body.personId) || !isUuid(body.reviewerId) ||
      !SIA_CATEGORIES.includes(category) || typeof body.untilAt !== "string" || Number.isNaN(Date.parse(body.untilAt))) return forbidden();
    const { data, error } = await client.rpc("grant_credential_reviewer_16b", {
      subject: body.personId, category, reviewer: body.reviewerId, until_at: body.untilAt,
    });
    return error ? privateJson({ error: "Grant denied" }, 409) : privateJson({ id: data }, 201);
  }
  if (body.action === "revokeGrant") {
    if (!principal.roles.includes("SUPER_ADMIN") || !isUuid(body.grantId)) return forbidden();
    const { error } = await client.rpc("revoke_credential_reviewer_16b", { requested_grant: body.grantId });
    return error ? privateJson({ error: "Grant revocation denied" }, 409) : privateJson({ id: body.grantId }, 201);
  }
  return privateJson({ error: "Invalid action" }, 400);
}
