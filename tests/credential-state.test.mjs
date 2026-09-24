import assert from 'node:assert/strict';
import { test } from 'node:test';
import { credentialState } from '../src/lib/credentials/state.ts';

const claim = { latest_revision_id: 'revision-1', draft_change_seq: 4, withdrawn_at: null };
const revision = { id: 'revision-1', draft_change_seq: 4, expires_on: '2029-02-26' };
const verified = [{ revision_id: 'revision-1', decision: 'VERIFIED' }];

test('16B exact revision, withdrawal, revocation and London date boundary', () => {
  assert.equal(credentialState(claim, revision, [], '2029-02-26'), 'REVIEW_PENDING');
  assert.equal(credentialState(claim, revision, verified, '2029-02-26'), 'VERIFIED');
  assert.equal(credentialState(claim, revision, verified, '2029-02-27'), 'EXPIRED');
  assert.equal(credentialState({ ...claim, draft_change_seq: 5 }, revision, verified, '2029-02-26'), 'RESUBMISSION_REQUIRED');
  assert.equal(credentialState({ ...claim, draft_change_seq: 6 }, revision, verified, '2029-02-26'), 'RESUBMISSION_REQUIRED');
  assert.equal(credentialState(claim, revision, [...verified, { revision_id: 'revision-1', decision: 'REVOKED' }], '2029-02-26'), 'REVOKED');
  assert.equal(credentialState({ ...claim, withdrawn_at: '2026-09-24T12:00:00Z' }, revision, verified, '2029-02-26'), 'WITHDRAWN');
  assert.equal(credentialState({ ...claim, latest_revision_id: 'revision-2' }, revision, verified, '2029-02-26'), 'DRAFT');
});
