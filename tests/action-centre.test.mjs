import { signInWithTestSession } from './helpers/auth-session.mjs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { readFileSync } from 'node:fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const identities = {
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staffA: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
  staffB: [process.env.KSS_TEST_STAFF_B_EMAIL, process.env.KSS_TEST_STAFF_B_PASSWORD],
};
const person = { office: '10000000-0000-4000-8000-000000000002', staffA: '10000000-0000-4000-8000-000000000003', staffB: '10000000-0000-4000-8000-000000000004' };

function client() { return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function signed(name) {
  const db = client();
  const { error } = await signInWithTestSession(db, { email: identities[name][0], password: identities[name][1] });
  assert.ifError(error);
  return db;
}
async function rpc(db, name, args) { const { data, error } = await db.rpc(name, args); assert.ifError(error); return data; }
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
async function port() {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const value = server.address().port; server.close(); await once(server, 'close'); return value;
}

test('08B Event allocation creates one own-only Action Centre item with current source truth', { timeout: 180000 }, async () => {
  assert.ok(url && key && Object.values(identities).every(([email, password]) => email && password));
  const [office, operations, staffA, staffB] = await Promise.all(Object.keys(identities).map(signed));
  const serviceDate = new Date(Date.UTC(2035 + Math.floor(Math.random() * 10), 5, 10 + Math.floor(Math.random() * 10))).toISOString().slice(0, 10);
  const tag = Date.now();
  const organisation = await rpc(office, 'crm_create_organisation', { p_name: `08B Synthetic Client ${tag}` });
  const opportunity = await rpc(office, 'crm_create_opportunity', { p_organisation: organisation, p_title: 'Synthetic deployment notification proof', p_type: 'DIRECT_ENQUIRY', p_owner: person.office });
  await rpc(office, 'crm_transition_opportunity', { p_id: opportunity, p_stage: 'WON' });
  const site = await office.from('sites').insert({ site_reference: `DEV-08B-${tag}`, name: 'Synthetic Notification Venue',
    address_line1: '1 Example Street', town_city: 'Exampletown', postcode: 'EX1 1AA', reporting_point: 'Main gate',
    created_by_person_id: person.office, site_type: 'STADIUM' }).select('id').single();
  assert.ifError(site.error);
  assert.ifError((await office.from('sites').update({ status: 'ACTIVE' }).eq('id', site.data.id)).error);
  await rpc(office, 'operational_link_site', { p_site: site.data.id, p_organisation: organisation });
  const event = await rpc(office, 'operational_create_event', { p_site: site.data.id, p_organisation: organisation,
    p_name: 'Synthetic Action Centre Fixture', p_type: 'FOOTBALL_MATCH',
    p_starts: `${serviceDate}T09:00:00+01:00`, p_ends: `${serviceDate}T19:00:00+01:00`, p_owner: person.office });
  const roles = Object.fromEntries((await rpc(office, 'staffing_role_choices', {})).map((row) => [row.code, row.id]));
  const createRequirement = (area, report, start, end) => rpc(office, 'staffing_create_confirmed', {
    p_event: event, p_role: roles.STEWARD, p_quantity: 1, p_report: `${serviceDate}T${report}+01:00`,
    p_start: `${serviceDate}T${start}+01:00`, p_end: `${serviceDate}T${end}+01:00`, p_area: area,
    p_instructions: 'Synthetic planning only', p_reason: null, p_confirm_duplicate: false, p_confirm_exception: false,
  });
  const activeRequirement = await createRequirement('Synthetic west gate', '10:30:00', '11:00:00', '13:00:00');
  const cancelledRequirement = await createRequirement('Synthetic east gate', '14:30:00', '15:00:00', '17:00:00');
  const allocate = (requirement) => ({ p_event: event, p_requirement: requirement, p_person: person.staffA,
    p_expected_revision: 1, p_acknowledge_warnings: true, p_reason: 'Synthetic Action Centre proof' });

  const race = await Promise.all([office.rpc('deployment_allocate', allocate(activeRequirement)), operations.rpc('deployment_allocate', allocate(activeRequirement))]);
  assert.equal(race.filter((result) => !result.error).length, 1, 'only one concurrent allocation commits');
  const allocation = race.find((result) => !result.error).data;
  const cancelledAllocation = await rpc(office, 'deployment_allocate', allocate(cancelledRequirement));
  await rpc(office, 'deployment_cancel', { p_event: event, p_requirement: cancelledRequirement,
    p_allocation: cancelledAllocation, p_expected_revision: 1, p_reason: 'Synthetic cancellation state proof' });

  const [staffAList, staffBList, operationsList, officeList] = await Promise.all([
    rpc(staffA, 'staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
    staffB.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
    operations.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
    office.rpc('staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 }),
  ]);
  assert.ifError(staffAList.error);
  assert.ok(Array.isArray(staffAList.items), `Staff Action Centre must return an item list: ${JSON.stringify(staffAList)}`);
  const activeItem = staffAList.items.find((item) => item.allocationId === allocation);
  const cancelledItem = staffAList.items.find((item) => item.allocationId === cancelledAllocation);
  assert.ok(activeItem, 'committed Event allocation created a notification');
  assert.ok(cancelledItem, 'cancelled allocation retains its notification history');
  assert.equal(activeItem.requiresAction, true);
  assert.equal(activeItem.currentMessage, 'Your response is required in My Deployments.');
  assert.equal(cancelledItem.requiresAction, false);
  assert.equal(cancelledItem.currentMessage, 'This deployment is no longer active.');
  assert.ifError(staffBList.error);
  assert.ok(!staffBList.data?.items?.some((item) => item.allocationId === allocation),
    'different Staff can read only their own Action Centre projection');
  assert.ok(operationsList.error, 'Operations cannot read the personal Action Centre');
  assert.ok(officeList.error, 'Office cannot read the personal Action Centre');
  assert.ok((await staffA.from('staff_in_app_notifications').select('id')).error, 'direct notification table read is denied');
  assert.ok((await staffA.from('staff_in_app_notification_events').select('id')).error, 'direct notification audit read is denied');
  assert.deepEqual(Object.keys(activeItem).sort(), [
    'allocationId', 'allocationStatus', 'createdAt', 'currentMessage', 'dismissedAt', 'eventName', 'eventStatus',
    'id', 'readAt', 'reportAt', 'requiresAction', 'requirementState', 'roleName', 'serviceDate', 'shiftEndsAt', 'shiftStartsAt', 'siteName',
  ].sort(), 'the notification projection contains only the safe operational fields');
  assert.doesNotMatch(readFileSync(new URL('../src/components/action-centre-client.tsx', import.meta.url), 'utf8'), /Accept allocation|Decline allocation/,
    'Action Centre has no accept/decline action; responses remain on My Deployments');

  const myDeployments = await rpc(staffA, 'my_deployments', { p_offset: 0, p_limit: 50 });
  assert.equal(myDeployments.items.find((item) => item.id === allocation)?.status, 'ALLOCATED', 'notification does not accept/decline the allocation');
  assert.equal(staffAList.items.filter((item) => item.allocationId === allocation).length, 1, 'one logical notification follows duplicate concurrent allocation attempts');

  const actionUrl = `http://127.0.0.1:${await port()}`;
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', new URL(actionUrl).port], { cwd: process.cwd(), stdio: 'ignore' });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(actionUrl); break; } catch { await new Promise((resolve) => setTimeout(resolve, 200)); } }
    const cookies = Object.fromEntries(await Promise.all(['staffA', 'staffB', 'office', 'operations'].map(async (name) => [name, await cookieFor(name)])));
    const get = (path, who) => fetch(actionUrl + path, { headers: who ? { cookie: cookies[who] } : {}, redirect: 'manual' });
    assert.equal((await get('/api/action-centre', null)).status, 401);
    assert.equal((await get('/api/action-centre', 'staffA')).status, 200);
    assert.equal((await get('/api/action-centre', 'staffB')).status, 200);
    assert.equal((await get('/api/action-centre', 'operations')).status, 403);
    assert.equal((await get('/api/action-centre', 'office')).status, 403);
    assert.equal((await get('/action-centre', 'staffA')).status, 200);
    assert.equal((await get('/action-centre', 'operations')).status, 404);
    assert.equal((await get('/action-centre', 'office')).status, 404);
    const responsePage = await get('/my-deployments?allocationId=' + allocation, 'staffA');
    assert.equal(responsePage.status, 200, 'deep link resolves through the existing authorised My Deployments route');
    const exactDeployment = await (await get(`/api/deployments/me?allocationId=${allocation}`, 'staffA')).json();
    assert.equal(exactDeployment.deployments.items.length, 1);
    assert.equal(exactDeployment.deployments.items[0].id, allocation);
    assert.equal(exactDeployment.deployments.items[0].source, 'EVENT');
    const otherPersonDeepLink = await (await get(`/api/deployments/me?allocationId=${allocation}`, 'staffB')).json();
    assert.equal(otherPersonDeepLink.deployments.total, 0, 'deep-link exact source projection independently reauthorizes the current Person');

    const body = await (await get('/api/action-centre?section=UNREAD', 'staffA')).json();
    const unread = body.items.find((item) => item.allocationId === allocation);
    assert.ok(unread, 'new allocation is unread');
    assert.equal(unread.requiresAction, true);
    const forgedRecipient = await fetch(`${actionUrl}/api/action-centre/${unread.id}`, {
      method: 'PATCH', headers: { cookie: cookies.staffA, 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'READ', recipientPersonId: person.staffB }),
    });
    assert.equal(forgedRecipient.status, 400, 'notification recipient is not caller supplied');
    const guessed = await fetch(`${actionUrl}/api/action-centre/${crypto.randomUUID()}`, {
      method: 'PATCH', headers: { cookie: cookies.staffB, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'READ' }),
    });
    assert.equal(guessed.status, 404);
    const knownOther = await fetch(`${actionUrl}/api/action-centre/${unread.id}`, {
      method: 'PATCH', headers: { cookie: cookies.staffB, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'READ' }),
    });
    assert.equal(knownOther.status, 404, 'another Staff member cannot change the exact notification by guessing its ID');
    const markRead = await fetch(`${actionUrl}/api/action-centre/${unread.id}`, {
      method: 'PATCH', headers: { cookie: cookies.staffA, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'READ' }),
    });
    assert.equal(markRead.status, 200);
    const afterRead = await rpc(staffA, 'staff_action_centre', { p_section: 'RECENT', p_offset: 0, p_limit: 50 });
    const readItem = afterRead.items.find((item) => item.allocationId === allocation);
    assert.ok(readItem.readAt);
    assert.equal(readItem.allocationStatus, 'ALLOCATED');
    const dismiss = await fetch(`${actionUrl}/api/action-centre/${readItem.id}`, {
      method: 'PATCH', headers: { cookie: cookies.staffA, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'DISMISS' }),
    });
    assert.equal(dismiss.status, 200);
    const history = await rpc(staffA, 'staff_action_centre', { p_section: 'DISMISSED', p_offset: 0, p_limit: 50 });
    const dismissed = history.items.find((item) => item.allocationId === allocation);
    assert.ok(dismissed.dismissedAt);
    assert.equal(dismissed.allocationStatus, 'ALLOCATED', 'read and dismiss changed presentation only');
    const acceptOnDeployment = await fetch(`${actionUrl}/api/deployments/me/${allocation}`, {
      method: 'PATCH', headers: { cookie: cookies.staffA, 'content-type': 'application/json' },
      body: JSON.stringify({ response: 'ACCEPTED', expectedRevision: 1 }),
    });
    assert.equal(acceptOnDeployment.status, 200, 'Staff response remains on the authoritative My Deployments route');
    const afterAcceptance = await rpc(staffA, 'staff_action_centre', { p_section: 'DISMISSED', p_offset: 0, p_limit: 50 });
    assert.equal(afterAcceptance.items.find((item) => item.allocationId === allocation)?.currentMessage, 'You accepted this deployment.');
    assert.equal(afterAcceptance.items.find((item) => item.allocationId === allocation)?.requiresAction, false);
    await rpc(office, 'deployment_cancel', { p_event: event, p_requirement: activeRequirement,
      p_allocation: allocation, p_expected_revision: 2, p_reason: 'Synthetic Action Centre fixture cleanup' });
  } finally { server.kill('SIGTERM'); }
});
