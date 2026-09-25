import { getPrincipal, isUuid } from "@/lib/auth/principal";
import { privateJson, unauthorised } from "@/lib/auth/responses";
import { sha256 } from "@/lib/documents/file";
import { downloadPrivatePdf, uploadPrivatePdf } from "@/lib/documents/private-pdf-storage";
import { documentServerProof } from "@/lib/documents/server-proof";
import { createServerSupabase } from "@/lib/supabase/server";
import { renderCertificatePdf, type CertificatePdfFacts } from "@/lib/training/certificate-pdf";

export const runtime = "nodejs";
const reason = (value: unknown): value is string => typeof value === "string" && value.trim().length >= 10 && value.trim().length <= 300;
const bounded = (value: unknown, min: number, max: number): value is string =>
  typeof value === "string" && value.trim().length >= min && value.trim().length <= max;

export async function GET(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const params = new URL(request.url).searchParams;
  const view = params.get("view");
  const assignment = params.get("assignmentId");
  const operation = view === "templates" ? client.rpc("training_certificate_templates")
    : view === "history" && assignment && isUuid(assignment)
      ? client.rpc("training_certificate_history", { p_assignment: assignment }) : null;
  if (!operation) return privateJson({ error: "Invalid certificate view" }, 400);
  const { data, error } = await operation;
  return error ? privateJson({ error: "Certificate history unavailable" }, 403) : privateJson({ data });
}

export async function POST(request: Request) {
  const client = await createServerSupabase();
  if (!(await getPrincipal(client))) return unauthorised();
  const body = await request.json().catch(() => null);
  if (body?.action === "PUBLISH_TEMPLATE" && bounded(body.title, 3, 32) &&
      bounded(body.issuerLabel, 3, 40) && bounded(body.statement, 10, 180)) {
    try {
      await renderCertificatePdf({
        issueId: "11111111-1111-4111-8111-111111111111", reference: "KSS-T-1234567890ABCDEF1234",
        completionId: "22222222-2222-4222-8222-222222222222", personName: "Synthetic Learner",
        courseTitle: "Synthetic Course", courseVersion: 1, templateTitle: body.title,
        issuerLabel: body.issuerLabel, statement: body.statement, templateVersion: 1,
        templateHash: "0".repeat(64), issuedAt: new Date().toISOString(),
        issueDate: "2026-09-25", expiryOn: null,
      });
    } catch { return privateJson({ error: "Template text exceeds the certificate layout" }, 400); }
    const { data: id, error } = await client.rpc("training_certificate_publish_template", {
      p_title: body.title, p_issuer_label: body.issuerLabel, p_statement: body.statement,
    });
    if (error || !id) return privateJson({ error: "Template publication denied" }, 403);
    const { data: templates, error: readError } = await client.rpc("training_certificate_templates");
    const found = !readError && Array.isArray(templates) && templates.some(item => item.id === id);
    return found ? privateJson({ data: { id, status: "PUBLISHED" } })
      : privateJson({ error: "Template publication readback unconfirmed" }, 503);
  }
  if (body?.action === "REVOKE" && isUuid(body.issueId) && isUuid(body.requestId) && reason(body.reason)) {
    const { data, error } = await client.rpc("training_certificate_revoke", {
      p_issue: body.issueId, p_reason: body.reason.trim(), p_request: body.requestId,
    });
    if (error || data?.state !== "REVOKED") return privateJson({ error: "Revocation denied" }, 403);
    const { data: history, error: readError } = await client.rpc("training_certificate_history", { p_assignment: data.assignmentId });
    const found = !readError && Array.isArray(history) && history.some(item => item.id === data.issueId && item.state === "REVOKED");
    return found ? privateJson({ data }) : privateJson({ error: "Revocation readback unconfirmed" }, 503);
  }
  if (body?.action === "ISSUE" && isUuid(body.completionId) && isUuid(body.templateVersionId) &&
      isUuid(body.requestId) && (body.reissueOf === null || isUuid(body.reissueOf)) && reason(body.reason)) {
    const why = body.reason.trim();
    const prior = body.reissueOf ?? "";
    const { data: reservation, error: beginError } = await client.rpc("training_certificate_issue_begin", {
      p_completion: body.completionId, p_template: body.templateVersionId, p_request: body.requestId,
      p_reissue_of: body.reissueOf, p_reason: why,
      p_proof: documentServerProof("certificate_begin", body.completionId, body.templateVersionId, body.requestId, prior, why),
    });
    if (beginError || !reservation) return privateJson({ error: "Certificate issue denied or already exists" }, 403);
    if (reservation.state === "FAILED") return privateJson({ error: "Prior issue attempt failed; start a new request" }, 409);
    if (reservation.state === "REVOKED") return privateJson({ data: {
      issueId: reservation.issueId, reference: reservation.reference, state: "REVOKED",
    } });
    if (reservation.state === "ISSUED") {
      const { data: history, error: readError } = await client.rpc("training_certificate_history", { p_assignment: reservation.assignmentId });
      return !readError && Array.isArray(history) && history.some(item => item.id === reservation.issueId && item.current)
        ? privateJson({ data: { issueId: reservation.issueId, reference: reservation.reference, state: "ISSUED" } })
        : privateJson({ error: "Certificate issue readback unconfirmed" }, 503);
    }
    let bytes: Uint8Array;
    try { bytes = await renderCertificatePdf(reservation as CertificatePdfFacts); }
    catch {
      await client.rpc("training_certificate_issue_fail", {
        p_issue: reservation.issueId, p_proof: documentServerProof("certificate_fail", reservation.issueId),
      });
      return privateJson({ error: "Certificate PDF could not be rendered; no issue confirmed" }, 503);
    }
    try {
      const hash = sha256(bytes);
      const uploaded = await uploadPrivatePdf("training-certificates", reservation.objectKey, bytes);
      const stored = await downloadPrivatePdf("training-certificates", reservation.objectKey, hash);
      if (!stored || stored.byteLength !== bytes.length) return privateJson({
        error: uploaded ? "Stored PDF verification failed; issue remains unconfirmed" : "Issue is in progress or private PDF storage is unavailable",
      }, 503);
      const { data: finalised, error: finishError } = await client.rpc("training_certificate_issue_finish", {
        p_issue: reservation.issueId, p_sha256: hash, p_bytes: bytes.length,
        p_proof: documentServerProof("certificate_finish", reservation.issueId, hash, String(bytes.length)),
      });
      if (finishError || finalised?.state !== "ISSUED") throw new Error("Certificate finalisation failed");
      const { data: history, error: readError } = await client.rpc("training_certificate_history", { p_assignment: reservation.assignmentId });
      if (readError || !Array.isArray(history) || !history.some(item => item.id === reservation.issueId && item.current))
        return privateJson({ error: "Certificate issue readback unconfirmed" }, 503);
      return privateJson({ data: finalised });
    } catch {
      return privateJson({ error: "Certificate issue unconfirmed; check the authoritative history" }, 503);
    }
  }
  return privateJson({ error: "Invalid certificate request" }, 400);
}
