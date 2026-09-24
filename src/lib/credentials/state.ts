import { londonToday } from "../profile/policy.ts";

export type CredentialClaimState = {
  latest_revision_id: string | null; draft_change_seq: number; withdrawn_at: string | null;
};
export type CredentialRevisionState = {
  id: string; draft_change_seq: number; expires_on: string | null;
};
export type CredentialDecisionState = { revision_id: string; decision: "VERIFIED" | "REJECTED" | "REVOKED" };

export function credentialState(claim: CredentialClaimState, revision: CredentialRevisionState | null,
  decisions: CredentialDecisionState[], asOf = londonToday()) {
  if (claim.withdrawn_at) return "WITHDRAWN";
  if (!revision || claim.latest_revision_id !== revision.id) return "DRAFT";
  if (claim.draft_change_seq !== revision.draft_change_seq) return "RESUBMISSION_REQUIRED";
  const forRevision = decisions.filter((item) => item.revision_id === revision.id);
  if (forRevision.some((item) => item.decision === "REVOKED")) return "REVOKED";
  if (forRevision.some((item) => item.decision === "REJECTED")) return "REJECTED";
  if (revision.expires_on && revision.expires_on < asOf) return "EXPIRED";
  if (forRevision.some((item) => item.decision === "VERIFIED")) return "VERIFIED";
  return "REVIEW_PENDING";
}
