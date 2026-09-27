import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signInWithTestSession } from './helpers/auth-session.mjs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const users = {
  office: [process.env.KSS_TEST_OFFICE_EMAIL, process.env.KSS_TEST_OFFICE_PASSWORD],
  operations: [process.env.KSS_TEST_OPERATIONS_EMAIL, process.env.KSS_TEST_OPERATIONS_PASSWORD],
  staff: [process.env.KSS_TEST_STAFF_A_EMAIL, process.env.KSS_TEST_STAFF_A_PASSWORD],
};
async function signed(name) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await signInWithTestSession(client, { email: users[name][0], password: users[name][1] });
  assert.ifError(error);
  return client;
}
const pageArgs = {
  p_search: null, p_class: null, p_holder_kind: null, p_context: null,
  p_condition: null, p_repair: null, p_exception: null, p_return: null,
  p_view: 'ALL', p_page: 1, p_size: 2,
};

test('PRODUCT-07 guarded register page, filters and stock choices', { timeout: 120000 }, async () => {
  assert.ok(url && key && Object.values(users).every(([email, password]) => email && password));
  const [office, operations, staff] = await Promise.all(Object.keys(users).map(signed));
  const { data: first, error } = await office.rpc('asset_register_page', pageArgs);
  assert.ifError(error);
  assert.ok(first.items.length <= 2 && first.total >= first.items.length);
  assert.equal(first.page, 1);
  if (first.total > 2) {
    const { data: second, error: secondError } = await office.rpc('asset_register_page', { ...pageArgs, p_page: 2 });
    assert.ifError(secondError);
    assert.ok(second.items.every(item => !first.items.some(previous => previous.id === item.id)));
  }
  const { data: absent, error: absentError } = await office.rpc('asset_register_page', {
    ...pageArgs, p_search: 'PRODUCT07-NO-MATCH-' + crypto.randomUUID(),
  });
  assert.ifError(absentError);
  assert.equal(absent.total, 0);
  assert.deepEqual(absent.items, []);
  const { data: available, error: availableError } = await office.rpc('asset_register_page', {
    ...pageArgs, p_view: 'AVAILABLE', p_size: 100,
  });
  assert.ifError(availableError);
  assert.ok(available.items.every(item => item.availabilityReason === 'Available from store'));
  assert.ok((await staff.rpc('asset_register_page', pageArgs)).error, 'Staff cannot read manager register');
  assert.ok((await staff.rpc('asset_register_support')).error, 'Staff cannot read register support');
  const { data: opsPage, error: opsError } = await operations.rpc('asset_register_page', pageArgs);
  assert.ifError(opsError);
  assert.ok(opsPage.items.length <= 2);
  const { data: support, error: supportError } = await office.rpc('asset_register_support');
  assert.ifError(supportError);
  assert.ok(Array.isArray(support.stock) && Array.isArray(support.contexts));
  if (support.stock.length) {
    const stockId = support.stock[0].id;
    const { data: choices, error: choicesError } = await office.rpc('asset_stock_issue_choices', { p_stock: stockId });
    assert.ifError(choicesError);
    assert.ok(Array.isArray(choices));
    assert.ok(choices.every(choice => choice.outstanding > 0 && choice.acknowledgement !== 'PENDING'));
    assert.ok((await staff.rpc('asset_stock_issue_choices', { p_stock: stockId })).error,
      'Staff cannot enumerate outstanding stock recipients');
  }
  const fakeEvent = crypto.randomUUID();
  const { data: receipt, error: receiptError } = await staff.rpc('asset_event_receipt', { p_event: fakeEvent });
  assert.ifError(receiptError);
  assert.equal(receipt, null, 'Unknown event yields no private receipt');
});
