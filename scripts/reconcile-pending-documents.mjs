#!/usr/bin/env node
// TASK-02A development-only reconciliation for synthetic stale upload attempts.
// Dry-run by default. Never touches submitted versions or unknown objects.
import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.KSS_TEST_ADMIN_EMAIL;
const password = process.env.KSS_TEST_ADMIN_PASSWORD;
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ageIndex = args.indexOf('--age-hours');
const ageHours = ageIndex >= 0 ? Number(args[ageIndex + 1]) : 24;
if (projectUrl !== 'https://dnfhkmmnlbiabqypclqg.supabase.co' || !key ||
  email !== 'kss01b.admin@example.test' || !password || !Number.isFinite(ageHours) || ageHours < 24) {
  throw new Error('Dedicated development project, synthetic Super Admin and age >=24h are required');
}
const db = createClient(projectUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: authError } = await db.auth.signInWithPassword({ email, password });
if (authError) throw new Error('Synthetic Super Admin authentication failed');
const cutoff = new Date(Date.now() - ageHours * 3600_000).toISOString();
const { data: pending, error } = await db.from('document_versions')
  .select('id,document_id,object_key,upload_state,created_at')
  .eq('upload_state', 'PENDING_UPLOAD').lt('created_at', cutoff).order('created_at').limit(100);
if (error) throw new Error('Could not inspect pending versions');
let eligible = 0;
let cleaned = 0;
for (const version of pending ?? []) {
  const { data: doc, error: docError } = await db.from('documents').select('request_id').eq('id', version.document_id).single();
  if (docError || !doc) continue;
  const { data: request, error: requestError } = await db.from('document_requests').select('title,status').eq('id', doc.request_id).single();
  if (requestError || !request || request.status !== 'REQUESTED' || !request.title.startsWith('Synthetic')) continue;
  eligible++;
  process.stdout.write(`${apply ? 'CLEANUP' : 'DRY RUN'} pending version ${version.id} (created ${version.created_at})\n`);
  if (!apply) continue;
  const { error: removeError } = await db.storage.from('enterprise-personnel-evidence').remove([version.object_key]);
  if (removeError) { process.stderr.write(`Could not remove pending object for ${version.id}\n`); continue; }
  const { data: done, error: cleanError } = await db.rpc('cleanup_stale_document_version', { requested_version: version.id });
  if (cleanError || !done) { process.stderr.write(`Could not clear pending metadata for ${version.id}\n`); continue; }
  cleaned++;
}
process.stdout.write(`Synthetic stale candidates: ${eligible}; cleaned: ${cleaned}; mode: ${apply ? 'apply' : 'dry-run'}\n`);
