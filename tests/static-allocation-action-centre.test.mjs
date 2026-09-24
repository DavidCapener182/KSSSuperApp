import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const identities = {
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staffA: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
};
const person = {
  office: '10000000-0000-4000-8000-000000000002',
  staffA: '10000000-0000-4000-8000-000000000003',
  staffB: '10000000-0000-4000-8000-000000000004',
};

function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signed(name) {
  const db = client();
  const { error } = await signInWithTestSession(db, { email: identities[name][0], password: identities[name][1] });
  assert.ifError(error);
  return db;
}
async function rpc(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  assert.ifError(error);
  return data;
}
async function cookieFor(name) {
  let cookies = [];
  const db = createServerClient(url, key, { cookies: {
    getAll: () => cookies,
    setAll: (items) => { cookies = items.map(({ name: cookieName, value }) => ({ name: cookieName, value })); },
  } });
  const { error } = await signInWithTestSession(db, { email: identities[name][0], password: identities[name][1] });
  assert.ifError(error);
  return cookies.map(({ name: cookieName, value }) => `${cookieName}=${value}`).join('; ');
}
async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const value = server.address().port;
  server.close();
  await once(server, 'close');
  return value;
}

test('08C static allocation creates one own-only Action Centre item and exact current deep link', { timeout: 240000 }, async () => {
  assert.ok(url && key && Object.values(identities).every(([email, password]) => email && password));
  const [office, operations, staffA, staffB] = await Promise.all(Object.keys(identities).map(signed));
  const tag = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const serviceDate = '2035-06-10';
  let allocation = null;
  let service = null;
  let demand = null;
  let cancelled = false;
  try {
    const organisation = await rpc(office, 'crm_create_organisation', { p_name: `08C Synthetic Client ${tag}` });
    const opportunity = await rpc(office, 'crm_create_opportunity', {
      p_organisation: organisation, p_title: 'Synthetic static notification proof',
      p_type: 'DIRECT_ENQUIRY', p_owner: person.office,
    });
    await rpc(office, 'crm_transition_opportunity', { p_id: opportunity, p_stage: 'WON' });
    const siteResult = await office.from('sites').insert({ site_reference: `DEV-08C-${tag}`,
      name: 'Synthetic Static Notification Site', address_line1: '1 Example Street', town_city: 'Exampletown',
      postcode: 'EX1 1AA', reporting_point: 'Main gate', created_by_person_id: person.office, site_type: 'WAREHOUSE' })
      .select('id').single();
    assert.ifError(siteResult.error);
    const site = siteResult.data.id;
    assert.ifError((await office.from('sites').update({ status: 'ACTIVE' }).eq('id', site)).error);
    await rpc(office, 'operational_link_site', { p_site: site, p_organisation: organisation });
    service = await rpc(office, 'site_service_create', {
      p_site: site, p_name: `08C Synthetic Service ${tag}`, p_type: 'STATIC_GUARDING',
      p_effective_from: serviceDate, p_owner: person.office,
    });
    await rpc(office, 'site_service_transition', {
      p_service: service, p_state: 'ACTIVE', p_effective_on: serviceDate,
      p_expected_revision: 1, p_reason: 'Synthetic 08C notification fixture',
    });
    const roles = await rpc(office, 'staffing_role_choices', {});
    const role = roles.find((item) => item.code === 'STEWARD');
    assert.ok(role, 'synthetic static fixture role exists');
    demand = await rpc(operations, 'site_shift_extra', {
      p_service: service, p_service_date: serviceDate, p_role: role.id, p_quantity: 1,
      p_report_at: `${serviceDate}T06:00:00+01:00`, p_shift_starts_at: `${serviceDate}T06:00:00+01:00`,
      p_shift_ends_at: `${serviceDate}T18:00:00+01:00`, p_area: 'Synthetic gatehouse',
      p_reporting: 'Main gate', p_reason: 'Synthetic 08C allocation notification fixture',
    });
    allocation = await rpc(operations, 'site_shift_allocate', {
      p_service: service, p_demand: demand, p_person: person.staffA, p_expected_revision: 1,
      p_acknowledge_warnings: true, p_reason: 'Synthetic 08C allocation notification fixture',
    });
    assert.ok(allocation);

    const [ownUnread, ownRecent, peer, operationsRead, officeRead] = await Promise.all([
      staffA.rpc('staff_action_centre', { p_section: 'UNREAD', p_offset: 0, p_limit: 50 }),
      staffA.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
      staffB.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
      operations.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
      office.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
    ]);
    assert.ifError(ownUnread.error);
    assert.ifError(ownRecent.error);
    const item = ownUnread.data.items.find((row) => row.allocationId === allocation);
    assert.ok(item, 'static allocation emits one unread notification');
    assert.equal(item.source, 'SITE_SHIFT');
    assert.equal(item.eventName, `08C Synthetic Service ${tag}`);
    assert.equal(item.currentMessage, 'Your response is required in My Deployments.');
    assert.equal(item.requiresAction, true);
    assert.equal(ownRecent.data.items.filter((row) => row.allocationId === allocation).length, 1);
    assert.ok(!peer.data?.items?.some((row) => row.allocationId === allocation), 'Staff B cannot read Staff A notification');
    assert.ok(operationsRead.error, 'Operations has no Staff personal Action Centre access');
    assert.ok(officeRead.error, 'Office has no Staff personal Action Centre access');
    assert.ok((await staffA.from('staff_in_app_notifications').select('id')).error, 'direct notification reads are denied');
    assert.ok((await staffA.from('staff_in_app_notification_events').insert({})).error, 'direct notification history writes are denied');
    assert.ok((await staffA.rpc('ensure_site_shift_notification_08c', { p_source_event: crypto.randomUUID() })).error,
      'authenticated clients cannot invoke the private producer');

    const focused = await rpc(staffA, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: allocation, p_focus_source: 'SITE_SHIFT',
    });
    assert.equal(focused.total, 1);
    assert.equal(focused.items[0].id, allocation);
    assert.equal(focused.items[0].source, 'SITE_SHIFT');
    assert.equal((await rpc(staffA, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: allocation, p_focus_source: 'EVENT',
    })).total, 0, 'source discriminator prevents Event/static UUID crossover');
    assert.equal((await rpc(staffB, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: allocation, p_focus_source: 'SITE_SHIFT',
    })).total, 0, 'deep link reauthorizes exact current Person');
    assert.equal((await rpc(staffA, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: null, p_focus_source: null,
    })).items.some((row) => row.id === allocation && row.source === 'SITE_SHIFT'), true);

    const notificationId = item.id;
    await rpc(staffA, 'staff_action_notification_change', { p_notification: notificationId, p_action: 'READ' });
    await rpc(staffA, 'staff_action_notification_change', { p_notification: notificationId, p_action: 'READ' });
    let current = await rpc(staffA, 'staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 });
    let readItem = current.items.find((row) => row.allocationId === allocation);
    assert.ok(readItem.readAt);
    assert.equal(readItem.allocationStatus, 'ALLOCATED', 'read did not change source state');
    assert.ok((await staffB.rpc('staff_action_notification_change', { p_notification: notificationId, p_action: 'READ' })).error,
      'peer cannot mutate presentation state');
    await rpc(staffA, 'staff_action_notification_change', { p_notification: notificationId, p_action: 'DISMISS' });
    await rpc(staffA, 'staff_action_notification_change', { p_notification: notificationId, p_action: 'DISMISS' });
    current = await rpc(staffA, 'staff_action_centre', { p_section: 'DISMISSED', p_offset: 0, p_limit: 50 });
    readItem = current.items.find((row) => row.allocationId === allocation);
    assert.ok(readItem.dismissedAt);
    assert.equal(readItem.allocationStatus, 'ALLOCATED', 'dismiss did not change source state');
    assert.equal((await rpc(staffA, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: allocation, p_focus_source: 'SITE_SHIFT',
    })).items[0].status, 'ALLOCATED');

    const port = await freePort();
    const origin = `http://127.0.0.1:${port}`;
    const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: process.cwd(), stdio: 'ignore',
    });
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        try { await fetch(origin); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); }
      }
      const staffCookies = await cookieFor('staffA');
      const staticDeepLink = `/my-deployments?allocationId=${allocation}&source=SITE_SHIFT`;
      const pageResponse = await fetch(origin + staticDeepLink, { headers: { cookie: staffCookies }, redirect: 'manual' });
      assert.equal(pageResponse.status, 200);
      const apiResponse = await fetch(`${origin}/api/deployments/me?allocationId=${allocation}&source=SITE_SHIFT`, {
        headers: { cookie: staffCookies },
      });
      assert.equal(apiResponse.status, 200);
      const apiBody = await apiResponse.json();
      assert.equal(apiBody.deployments.items.length, 1);
      assert.equal(apiBody.deployments.items[0].id, allocation);
      assert.equal(apiBody.deployments.items[0].source, 'SITE_SHIFT');
      assert.equal((await fetch(`${origin}/api/deployments/me?allocationId=${allocation}&source=EVENT`, {
        headers: { cookie: staffCookies },
      }).then((response) => response.json())).deployments.total, 0);
      assert.equal((await fetch(`${origin}/api/deployments/me?allocationId=${allocation}&source=SITE_SHIFT`, {
        headers: { cookie: await cookieFor('staffB') },
      }).then((response) => response.json())).deployments.total, 0);
    } finally { server.kill('SIGTERM'); }

    await rpc(office, 'site_shift_cancel_allocation', {
      p_service: service, p_demand: demand, p_allocation: allocation, p_expected_revision: 1,
      p_reason: 'Synthetic 08C current-state projection proof',
    });
    cancelled = true;
    const stale = await rpc(staffA, 'staff_action_centre', { p_section: 'DISMISSED', p_offset: 0, p_limit: 50 });
    const staleItem = stale.items.find((row) => row.allocationId === allocation);
    assert.ok(staleItem);
    assert.equal(staleItem.currentMessage, 'This Site shift is no longer active.');
    assert.equal(staleItem.requiresAction, false);
    const staleFocus = await rpc(staffA, 'my_deployments_08c', {
      p_offset: 0, p_limit: 25, p_focus: allocation, p_focus_source: 'SITE_SHIFT',
    });
    assert.equal(staleFocus.total, 1);
    assert.equal(staleFocus.items[0].status, 'CANCELLED');

    const sourceEvent = ownRecent.data.items.find((row) => row.allocationId === allocation);
    process.stdout.write(`TASK-08C_FIXTURE ${JSON.stringify({ service, demand, allocation, notificationId, tag })}\n`);
    assert.ok(sourceEvent);
  } finally {
    if (allocation && service && demand && !cancelled) {
      await rpc(office, 'site_shift_cancel_allocation', {
        p_service: service, p_demand: demand, p_allocation: allocation, p_expected_revision: 1,
        p_reason: 'Synthetic 08C notification fixture cleanup',
      }).catch(() => {});
    }
  }
});
