import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { signInWithTestSession } from "./helpers/auth-session.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const personId = "10000000-0000-4000-8000-000000000003"; // Synthetic Staff A.
const guessedId = "50000000-0000-4000-8000-000000000001";
const users = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
};
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signedIn(as) {
  const api = client();
  const { error } = await signInWithTestSession(api, { email: users[as][0], password: users[as][1] });
  assert.ifError(error);
  return api;
}

test("Person grant review is exact, read-only and Super Admin scoped", { timeout: 120000 }, async () => {
  assert.ok(url && key && Object.values(users).every((entry) => entry[0] && entry[1]));
  const [admin, office, operations, staff] = await Promise.all(Object.keys(users).map(signedIn));
  const anonymous = client();
  for (const api of [anonymous, office, operations, staff]) {
    const result = await api.rpc("person_domain_grants_review_10", { p_person: personId });
    assert.ok(result.error, "non-Super actor must not receive grant facts");
  }
  const result = await admin.rpc("person_domain_grants_review_10", { p_person: personId });
  assert.ifError(result.error);
  assert.ok(Array.isArray(result.data));
  for (const row of result.data) {
    assert.equal(typeof row.domain, "string");
    assert.equal(typeof row.capability, "string");
    assert.equal(typeof row.sourceHref, "string");
    assert.ok(row.sourceHref.startsWith("/"));
    assert.equal("synthetic_reference" in row, false);
    assert.equal("evidence_version_id" in row, false);
    assert.equal("file" in row, false);
  }
  const [roles, sites] = await Promise.all([
    admin.from("role_assignments").select("id").eq("person_id", personId),
    admin.from("site_assignments").select("id").eq("person_id", personId),
  ]);
  assert.ifError(roles.error);
  assert.ifError(sites.error);
  assert.ok(roles.data.length > 0, "synthetic Staff A has role history to review");
  assert.ok(sites.data.length > 0, "synthetic Staff A has Site assignment history to review");
  const guessed = await admin.rpc("person_domain_grants_review_10", { p_person: guessedId });
  assert.ok(guessed.error, "unknown Person must not return an empty-looking complete review");
});
