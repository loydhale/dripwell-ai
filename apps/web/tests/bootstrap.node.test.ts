import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBootstrapOptions, validateBootstrapPassword, assertPlatformIdentity } from '../scripts/bootstrap-platform-admin.mjs';

test('platform bootstrap requires a selected identity and rejects password arguments', () => {
  assert.throws(() => parseBootstrapOptions([]), /Select a valid/);
  assert.throws(() => parseBootstrapOptions(['--email', 'selected@example.invalid', '--password', 'private-secret']), /Password arguments are not accepted/);
  assert.deepEqual(parseBootstrapOptions(['--email', 'Selected@example.invalid', '--first-name', 'Selected', '--last-name', 'Operator']), {
    help: false, email: 'selected@example.invalid', firstName: 'Selected', lastName: 'Operator',
  });
});

test('platform bootstrap refuses to promote or move existing clinic identities', () => {
  assert.throws(() => assertPlatformIdentity({ role: 'SUPER_USER', tenantId: 'clinic', isActive: true }), /non-platform account/);
  assert.throws(() => assertPlatformIdentity({ role: 'STAFF', tenantId: null, isActive: true }), /non-platform account/);
  assert.throws(() => assertPlatformIdentity({ role: 'SYSTEM_ADMIN', tenantId: 'clinic', isActive: true }), /non-platform account/);
  assert.throws(() => assertPlatformIdentity({ role: 'SYSTEM_ADMIN', tenantId: null, isActive: false }), /inactive/);
  assert.doesNotThrow(() => assertPlatformIdentity({ role: 'SYSTEM_ADMIN', tenantId: null, isActive: true }));
});

test('administrator passwords require sufficient length and respect bcrypt byte bounds', () => {
  assert.throws(() => validateBootstrapPassword('short'), /at least 16/);
  assert.throws(() => validateBootstrapPassword('é'.repeat(40)), /at most 72/);
  assert.doesNotThrow(() => validateBootstrapPassword('synthetic-test-password-123'));
});
