import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const person = {
  admin: "10000000-0000-4000-8000-000000000001",
  office: "10000000-0000-4000-8000-000000000002",
  a: "10000000-0000-4000-8000-000000000003",
  b: "10000000-0000-4000-8000-000000000004",
};
const site = { a: "30000000-0000-4000-8000-000000000001", b: "30000000-0000-4000-8000-000000000002" };
const credentials = {
  admin: [process.env.KSS_TEST_ADMIN_EMAIL, process.env.KSS_TEST_ADMIN_PASSWORD],
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  a: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  b: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
};

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signIn(as) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email: credentials[as][0], password: credentials[as][1] });
  assert.ifError(error);
  assert.ok(data.user);
  return supabase;
}
async function availablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}
async function cookieFor(as) {
  let cookies = [];
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookies,
      setAll: (items) => { cookies = items.map(({ name, value }) => ({ name, value })); },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email: credentials[as][0], password: credentials[as][1] });
  assert.ifError(error);
  return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
}

test("authenticated RLS and server authorization", { timeout: 120000 }, async () => {
  assert.ok(url && key && credentials.admin[1] && credentials.a[1], "local test environment required");
  const anon = client();
  assert.ok((await anon.from("people").select("id")).error);
  assert.ok((await anon.from("sites").select("id")).error);

  const [admin, office, a, b] = await Promise.all([signIn("admin"), signIn("office"), signIn("a"), signIn("b")]);
  const staffPeople = await a.from("people").select("id").order("id");
  assert.ifError(staffPeople.error);
  assert.deepEqual(staffPeople.data.map((row) => row.id), [person.a]);
  assert.deepEqual((await a.from("people").select("id").eq("id", person.b)).data, []);
  const staffCount = await a.from("people").select("id", { count: "exact", head: true });
  assert.equal(staffCount.count, 1);
  const otherCount = await a.from("people").select("id", { count: "exact", head: true }).eq("id", person.b);
  assert.equal(otherCount.count, 0);
  assert.deepEqual((await a.from("sites").select("id")).data.map((row) => row.id), [site.a]);
  assert.deepEqual((await a.from("sites").select("id").eq("id", site.b)).data, []);
  assert.deepEqual((await b.from("people").select("id")).data.map((row) => row.id), [person.b]);
  assert.deepEqual((await b.from("sites").select("id")).data.map((row) => row.id), [site.b]);
  const expiredSite = await admin.from("site_assignments").select("effective_until").eq("id", "40000000-0000-4000-8000-000000000003").single();
  assert.ifError(expiredSite.error);
  assert.ok(Date.parse(expiredSite.data.effective_until) < Date.now());
  assert.deepEqual((await office.from("people").select("id")).data.map((row) => row.id), [person.office]);
  const officeSites = await office.from("sites").select("id,created_by_person_id");
  assert.ifError(officeSites.error);
  assert.ok(officeSites.data.some((row) => row.id === site.a));
  assert.ok(officeSites.data.every((row) => row.created_by_person_id === person.office));
  assert.deepEqual((await admin.from("people").select("id")).data.map((row) => row.id).sort(), Object.values(person).concat(["10000000-0000-4000-8000-000000000005", "10000000-0000-4000-8000-000000000006"]).sort());

  const deniedRole = await a.from("role_assignments").insert({ person_id: person.a, role_code: "SUPER_ADMIN" });
  assert.ok(deniedRole.error, "staff self-grant must fail");
  const deniedSite = await a.from("site_assignments").insert({ person_id: person.a, site_id: site.b });
  assert.ok(deniedSite.error, "staff self-scope escalation must fail");
  const deniedRoleUpdate = await a.from("role_assignments").update({ role_code: "SUPER_ADMIN" }).eq("id", "20000000-0000-4000-8000-000000000003").select("id");
  assert.deepEqual(deniedRoleUpdate.data, []);
  const deniedSiteUpdate = await a.from("site_assignments").update({ site_id: site.b }).eq("id", "40000000-0000-4000-8000-000000000001").select("id");
  assert.deepEqual(deniedSiteUpdate.data, []);
  assert.deepEqual((await a.from("audit_events").select("id")).data, []);

  // A provider record can attach to the same Person without changing their ID.
  const entraSubject = "synthetic-01b-provider-subject";
  const existingMapping = await admin.from("auth_identities").select("person_id").eq("provider", "entra").eq("provider_subject", entraSubject).maybeSingle();
  assert.ifError(existingMapping.error);
  if (!existingMapping.data) {
    const inserted = await admin.from("auth_identities").insert({ person_id: person.a, provider: "entra", provider_subject: entraSubject, active: false });
    assert.ifError(inserted.error);
  }
  const mapping = await admin.from("auth_identities").select("person_id,active").eq("provider", "entra").eq("provider_subject", entraSubject).single();
  assert.ifError(mapping.error);
  assert.equal(mapping.data.person_id, person.a);
  assert.equal(mapping.data.active, false);

  const port = await availablePort();
  const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 80; i++) {
      try { await fetch(base); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
    }
    const cookies = { admin: await cookieFor("admin"), office: await cookieFor("office"), a: await cookieFor("a"), b: await cookieFor("b") };
    const get = (path, as) => fetch(base + path, { headers: as ? { cookie: cookies[as] } : {} });
    assert.equal((await get(`/api/people/${person.a}`)).status, 401);
    assert.equal((await get(`/api/sites/${site.a}`)).status, 401);
    assert.equal((await get(`/api/people/${person.a}`, "a")).status, 200);
    assert.equal((await get(`/api/people/${person.b}`, "a")).status, 404);
    assert.equal((await get("/api/people/50000000-0000-4000-8000-000000000001", "a")).status, 404);
    assert.equal((await get(`/api/sites/${site.a}`, "a")).status, 200);
    assert.equal((await get(`/api/sites/${site.b}`, "a")).status, 404);
    assert.equal((await get(`/api/people/${person.b}`, "b")).status, 200);
    assert.equal((await get(`/api/sites/${site.b}`, "b")).status, 200);
    assert.equal((await get(`/api/people/${person.a}`, "b")).status, 404);
    assert.equal((await get(`/api/people/${person.office}`, "office")).status, 200);
    assert.equal((await get(`/api/people/${person.a}`, "office")).status, 404);
    assert.equal((await get(`/api/sites/${site.a}`, "office")).status, 200);
    assert.equal((await get(`/api/sites/${site.b}`, "office")).status, 404);
    assert.equal((await get(`/api/people/${person.b}`, "admin")).status, 200);
    const staffPost = await fetch(base + "/api/access/roles", { method: "POST", headers: { cookie: cookies.a, "content-type": "application/json" }, body: JSON.stringify({ personId: person.a, roleCode: "SUPER_ADMIN" }) });
    assert.equal(staffPost.status, 403);
    const officePost = await fetch(base + "/api/access/sites", { method: "POST", headers: { cookie: cookies.office, "content-type": "application/json" }, body: JSON.stringify({ personId: person.office, siteId: site.b }) });
    assert.equal(officePost.status, 400);

    // Expire the synthetic staff role, test both layers, then restore it.
    const roleId = "20000000-0000-4000-8000-000000000003";
    const expired = await admin.from("role_assignments").update({ effective_until: new Date(Date.now() - 1000).toISOString() }).eq("id", roleId);
    assert.ifError(expired.error);
    try {
      assert.deepEqual((await a.from("people").select("id")).data, []);
      assert.deepEqual((await a.from("sites").select("id")).data, []);
      assert.equal((await get(`/api/people/${person.a}`, "a")).status, 401);
    } finally {
      const restored = await admin.from("role_assignments").update({ effective_until: null }).eq("id", roleId);
      assert.ifError(restored.error);
    }
    const audit = await admin.from("audit_events").select("entity_type,action").eq("entity_id", roleId);
    assert.ifError(audit.error);
    assert.ok(audit.data.length >= 3, "grant and expiry/restoration must be audited");
  } finally {
    server.kill("SIGTERM");
    if (server.exitCode === null) await once(server, "exit");
  }
});
