import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';
import { safeReturnTarget } from '../src/lib/auth/return-target.ts';
// Explicit optional source root supports a frozen baseline; never load app .env files.
const root = process.env.KSS_SIGN_IN_SOURCE_ROOT || resolve(new URL('../', import.meta.url).pathname);
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join(' ') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const element = (type, props, key) => ({ type, props: props || {}, key });
const jsx = { jsx: element, jsxs: element, Fragment: 'fragment' };
const response = status => ({ ok: status === 200, status });
function execute(file, mocks, globals = {}) {
  const loaded = { exports: {} };
  const js = ts.transpileModule(readFileSync(resolve(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new vm.Script(js, { filename: file }).runInNewContext({ module: loaded, exports: loaded.exports, require: name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, name) => name }) };
    if (name === 'lucide-react') return new Proxy({}, { get: () => 'presentation-icon' });
    throw new Error(`Unexpected runtime dependency ${name}`);
  }, ...globals });
  return loaded.exports;
}
function harness(options = {}) {
  let cursor = 0, signedIn = options.signedIn ?? false, props = { returnTarget: options.returnTarget || '/my-schedule?week=2026-10-19' };
  const hooks = [], effects = [], calls = [], navigation = [];
  const same = (a, b) => a?.length === b?.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(value) { const i = cursor++; hooks[i] ??= { value: typeof value === 'function' ? value() : value }; return [hooks[i].value, next => { hooks[i].value = typeof next === 'function' ? next(hooks[i].value) : next; }]; },
    useCallback(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) hooks[i] = { fn, deps }; return hooks[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!same(hooks[i]?.deps, deps)) { const old = hooks[i]; hooks[i] = { deps }; effects.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); }); } },
    useRef(value) { const i = cursor++; return hooks[i] ??= { current: value }; },
  };
  const auth = {
    async getUser() { calls.push(['getUser']); return options.getUser ? options.getUser(signedIn) : { data: { user: signedIn ? { id: 'synthetic-auth-subject' } : null }, error: null }; },
    async signInWithPassword(value) { calls.push(['signIn', value]); const result = options.signIn ? await options.signIn(value) : { error: null }; if (!result.error) signedIn = true; return result; },
    async signOut() { calls.push(['signOut']); const result = options.signOut ? await options.signOut() : { error: null }; if (!result.error) signedIn = false; return result; },
  };
  const component = execute('src/components/sign-in-entry.tsx', { react, 'react/jsx-runtime': jsx,
    '@/lib/supabase/browser': { createBrowserSupabase: () => ({ auth }) }, '@/components/ui/button': { Button: 'button' }, '@/components/ui/input': { Input: 'input' },
    '@/lib/environment-label': { environmentLabel: 'Synthetic local fixture', isStaging: options.isStaging ?? false },
  }, { window: { location: { replace: target => navigation.push(target) } }, fetch: async (url, init) => {
    calls.push(['fetch', url, init]); assert.equal(url, '/api/me'); assert.equal(init?.cache, 'no-store'); assert.equal(init?.method ?? 'GET', 'GET');
    return options.fetch ? options.fetch() : response(200);
  } }).SignInEntry;
  const render = () => { cursor = 0; const tree = component(props); effects.splice(0).forEach(fn => fn()); return tree; };
  const settle = async () => { for (let i = 0; i < 5; i++) { await new Promise(setImmediate); render(); } };
  return { render, settle, calls, navigation, async mount() { render(); await settle(); }, async updateTarget(target) { props = { returnTarget: target }; render(); await settle(); },
    fill() { for (const [kind, value] of [['email', 'synthetic@example.invalid'], ['password', 'synthetic-test-value']]) { nodes(render()).find(n => n.type === 'input' && n.props.type === kind).props.onChange({ target: { value } }); render(); } },
    submit() { const form = nodes(render()).find(n => n.type === 'form'); assert.ok(form, 'Sign-in form available'); return form.props.onSubmit({ preventDefault() {} }); },
    click(pattern) { const button = nodes(render()).find(n => n.type === 'button' && pattern.test(text(n))); assert.ok(button, `Button ${pattern}`); return button.props.onClick(); },
  };
}
const fields = h => nodes(h.render()).filter(n => n.type === 'input');
const alerts = h => nodes(h.render()).filter(n => n.props.role === 'alert').map(text).join(' ');

test('password reveal is an explicit non-submit control and preserves autofill and entered value', async () => {
  const h = harness(); await h.mount(); h.fill();
  const show = nodes(h.render()).find(n => n.type === 'button' && /show\s+password/i.test(text(n)));
  assert.equal(show.props.type, 'button'); assert.equal(show.props['aria-pressed'], false);
  show.props.onClick();
  const field = fields(h).find(n => n.props.autoComplete === 'current-password');
  assert.equal(field.props.type, 'text'); assert.equal(field.props.value, 'synthetic-test-value');
  const hide = nodes(h.render()).find(n => n.type === 'button' && /hide\s+password/i.test(text(n)));
  assert.equal(hide.props['aria-controls'], field.props.id); assert.equal(hide.props['aria-pressed'], true);
  assert.equal(h.calls.filter(c => c[0] === 'signIn').length, 0);
  hide.props.onClick(); assert.equal(fields(h).find(n => n.props.autoComplete === 'current-password').props.type, 'password');
});
test('a revealed password is still cleared after a failed authentication attempt', async () => {
  const h = harness({ signIn: async () => ({ error: { message: 'Synthetic rejected credentials' } }) });
  await h.mount(); h.fill(); h.click(/show\s+password/i); await h.submit(); await h.settle();
  assert.equal(fields(h).find(n => n.props.autoComplete === 'current-password').props.value, '');
  assert.equal(h.navigation.length, 0); assert.match(alerts(h), /sign-in failed/i);
});

test('unauthenticated or rejected getUser exposes required labelled email/password without an API call', async () => {
  for (const getUser of [undefined, async () => ({ data: { user: null }, error: { message: 'Synthetic unavailable auth user' } })]) {
    const h = harness({ getUser }); await h.mount(); assert.equal(h.navigation.length, 0); assert.equal(h.calls.filter(c => c[0] === 'fetch').length, 0);
    for (const [type, completion] of [['email', 'username'], ['password', 'current-password']]) {
      const field = fields(h).find(n => n.props.type === type); assert.ok(field); assert.equal(field.props.required, true); assert.equal(field.props.autoComplete, completion);
      const labelled = nodes(h.render()).some(n => n.type === 'label' && new RegExp(type, 'i').test(text(n)) && (nodes(n).includes(field) || n.props.htmlFor === field.props.id));
      assert.ok(labelled || field.props['aria-label']?.toLowerCase().includes(type), `${type} has an accessible label`);
    }
  }
});
test('checking holds navigation until authenticated API200, then uses exact return target', async () => {
  const gate = deferred(); const target = '/my-duty?source=SITE_SHIFT&allocationId=00000000-0000-4000-8000-000000000001';
  const h = harness({ signedIn: true, returnTarget: target, fetch: () => gate.promise }); await h.mount();
  assert.equal(h.navigation.length, 0); assert.ok(nodes(h.render()).some(n => n.props.role === 'status'));
  gate.resolve(response(200)); await h.settle(); assert.deepEqual(h.navigation, [target]);
});
for (const status of [401, 403, 503]) test(`authenticated access API${status} never navigates or invents access`, async () => {
  const h = harness({ signedIn: true, fetch: () => response(status) }); await h.mount(); assert.equal(h.navigation.length, 0);
  if (status === 401) assert.equal(nodes(h.render()).filter(n => n.type === 'form').length, 1);
  if (status === 403) { assert.match(text(h.render()), /no.*access|access.*not|does not.*access/i); assert.equal(nodes(h.render()).filter(n => n.type === 'form').length, 0); }
  if (status === 503) assert.match(text(h.render()), /unavailable|could not confirm/i);
});
test('network-unavailable access exposes retry, which must recheck before exact navigation', async () => {
  let unavailable = true; const h = harness({ signedIn: true, fetch: () => { if (unavailable) throw new Error('Synthetic network failure'); return response(200); } });
  await h.mount(); assert.equal(h.navigation.length, 0); assert.match(text(h.render()), /unavailable|could not confirm/i);
  unavailable = false; h.click(/retry/i); await h.settle(); assert.deepEqual(h.navigation, ['/my-schedule?week=2026-10-19']);
});
test('successful password authentication waits for API200 and clears entered password', async () => {
  const gate = deferred(); const h = harness({ fetch: () => gate.promise }); await h.mount(); h.fill(); const submitted = h.submit(); await h.settle();
  assert.equal(h.navigation.length, 0); assert.equal(fields(h).find(n => n.props.type === 'password').props.value, '');
  assert.ok(nodes(h.render()).find(n => n.type === 'button' && n.props.type === 'submit').props.disabled);
  assert.equal(h.calls.filter(c => c[0] === 'signIn').length, 1); gate.resolve(response(200)); await submitted; await h.settle(); assert.equal(h.navigation.length, 1);
});
test('failed sign-in clears password, releases busy state and reports failure without an API request', async () => {
  const gate = deferred(); const h = harness({ signIn: () => gate.promise }); await h.mount(); h.fill(); const submitted = h.submit(); await h.settle();
  assert.ok(nodes(h.render()).find(n => n.type === 'button' && n.props.type === 'submit').props.disabled);
  gate.resolve({ error: { message: 'Synthetic rejected credentials' } }); await submitted; await h.settle();
  assert.equal(fields(h).find(n => n.props.type === 'password').props.value, ''); assert.match(alerts(h), /fail|unable|incorrect|could not|check/i);
  assert.equal(nodes(h.render()).find(n => n.type === 'button' && n.props.type === 'submit').props.disabled, false);
  assert.equal(h.navigation.length, 0); assert.equal(h.calls.filter(c => c[0] === 'fetch').length, 0);
});
for (const status of [401, 403, 503]) test(`successful sign-in followed by API${status} does not claim entry`, async () => {
  const h = harness({ fetch: () => response(status) }); await h.mount(); h.fill(); await h.submit(); await h.settle();
  assert.equal(h.navigation.length, 0); assert.equal(h.calls.filter(c => c[0] === 'fetch').length, 1);
  if (status === 401) assert.equal(fields(h).find(n => n.props.type === 'password').props.value, '');
  if (status === 403) assert.match(text(h.render()), /no.*access|access.*not|does not.*access/i);
  if (status === 503) assert.match(text(h.render()), /unavailable|could not confirm/i);
});
test('no-access sign-out remains pending, then returns to cleared form only after auth success', async () => {
  const gate = deferred(); const h = harness({ fetch: () => response(403), signOut: () => gate.promise }); await h.mount(); h.fill(); await h.submit(); await h.settle();
  h.click(/sign.*out/i); await h.settle(); assert.ok(nodes(h.render()).find(n => n.type === 'button').props.disabled); assert.equal(fields(h).length, 0);
  gate.resolve({ error: null }); await h.settle(); assert.equal(h.navigation.length, 0); assert.equal(fields(h).length, 2); assert.ok(fields(h).every(n => n.props.value === ''));
});
test('failed sign-out retains no-access state and enables retry without false logged-out success', async () => {
  const h = harness({ signedIn: true, fetch: () => response(403), signOut: async () => ({ error: { message: 'Synthetic signout failure' } }) }); await h.mount(); h.click(/sign.*out/i); await h.settle();
  assert.match(alerts(h), /fail|unable|could not/i); assert.equal(fields(h).length, 0); assert.equal(h.navigation.length, 0);
  assert.equal(nodes(h.render()).find(n => n.type === 'button').props.disabled, false);
});
test('page normalises unsafe return destinations before passing props to the actual entry', async () => {
  const page = execute('src/app/page.tsx', { 'react/jsx-runtime': jsx, '@/components/sign-in-entry': { SignInEntry: 'entry' }, '@/lib/auth/return-target': { safeReturnTarget } }).default;
  for (const next of ['https://example.invalid', '//example.invalid', '/app#private', ['app'], '/unknown']) assert.equal((await page({ searchParams: Promise.resolve({ next }) })).props.returnTarget, '/app');
  const exact = '/my-duty?source=EVENT&allocationId=00000000-0000-4000-8000-000000000001'; assert.equal((await page({ searchParams: Promise.resolve({ next: exact }) })).props.returnTarget, exact);
});
