import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlatformAdminEmail } from './platform-admin-policy';

test('platform admin allowlist is fail-closed when missing or empty', () => {
  assert.equal(isPlatformAdminEmail('admin@example.com', undefined), false);
  assert.equal(isPlatformAdminEmail('admin@example.com', ''), false);
  assert.equal(isPlatformAdminEmail(undefined, 'admin@example.com'), false);
});

test('platform admin allowlist matches exact emails case-insensitively', () => {
  assert.equal(
    isPlatformAdminEmail(' Admin@Example.com ', 'other@example.com, admin@example.com'),
    true
  );
  assert.equal(isPlatformAdminEmail('admin@example.com.attacker.test', 'admin@example.com'), false);
  assert.equal(isPlatformAdminEmail('member@example.com', 'admin@example.com'), false);
});
