import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  Role,
  assertOrganizationMembership,
  assertTenantAccess,
  listUserOrganizations,
  prisma,
  resolveActiveOrganization
} from '@circuitsoul/db';
import {
  Permission,
  parseSession,
  requireMembership,
  requirePermission,
  requireActiveSession,
  requireAuthenticatedOrg,
  requireAuthenticatedPermission,
  requireRole,
  requireSession,
  signSessionToken,
  switchOrganization,
  verifySessionToken
} from './index.ts';

test('verifySessionToken rejects tampered signed sessions', () => {
  const session = {
    userId: 'user-123',
    email: 'user@example.com',
    orgId: 'org-tenant-a',
    role: Role.ADMIN
  };

  const token = signSessionToken(session);
  const tampered = token.slice(0, -1) + (token.at(-1) === 'A' ? 'B' : 'A');

  assert.equal(verifySessionToken(tampered), null);
  assert.equal(verifySessionToken(token)?.userId, 'user-123');
});

test('parseSession and requireSession reject invalid or missing identities', () => {
  assert.equal(parseSession({}), null);
  assert.equal(parseSession({ authorization: 'Bearer invalid-token' }), null);
  assert.throws(() => requireSession({}), /Unauthorized/);
  assert.throws(() => requireSession({ authorization: 'Bearer invalid-token' }), /Unauthorized/);
});

test('valid signed session cookies still verify and carry org context', () => {
  const session = {
    userId: 'user-456',
    email: 'owner@example.com',
    orgId: 'org-tenant-b',
    role: Role.OWNER
  };

  const token = signSessionToken(session);
  const parsed = parseSession({ cookie: `circuitsoul_session=${encodeURIComponent(token)}` });

  assert.ok(parsed);
  assert.equal(parsed?.userId, session.userId);
  assert.equal(parsed?.orgId, session.orgId);
  assert.equal(parsed?.role, Role.OWNER);
});

test('switchOrganization verifies DB membership before allowing org switch', async () => {
  const originalFindUnique = prisma.membership.findUnique.bind(prisma.membership);

  try {
    // User is a member of org-tenant-d with ADMIN role
    prisma.membership.findUnique = async () =>
      ({ id: 'm-1', organizationId: 'org-tenant-d', role: Role.ADMIN } as any);

    const role = await switchOrganization('user-999', 'org-tenant-d');
    assert.equal(role, Role.ADMIN);

    // User is not a member of org-unknown
    prisma.membership.findUnique = async () => null;

    await assert.rejects(
      () => switchOrganization('user-999', 'org-unknown'),
      /TenantAccessDenied/
    );
  } finally {
    prisma.membership.findUnique = originalFindUnique;
  }
});

test('parseSession ignores caller-supplied organization overrides', () => {
  const session = {
    userId: 'user-override',
    email: 'override@example.com',
    orgId: 'org-original',
    role: Role.MEMBER
  };

  const token = signSessionToken(session);
  const parsed = parseSession({
    cookie: `circuitsoul_session=${encodeURIComponent(token)}`,
    'x-circuitsoul-org-id': 'org-selected'
  });

  assert.ok(parsed);
  assert.equal(parsed?.userId, 'user-override');
  assert.equal(parsed?.orgId, 'org-original');
  assert.equal(parsed?.role, Role.MEMBER);
});

test('role checks reject unauthorized sessions and accept valid membership', () => {
  const adminSession = {
    userId: 'user-789',
    email: 'admin@example.com',
    orgId: 'org-tenant-c',
    role: Role.ADMIN
  };

  const memberSession = { ...adminSession, userId: 'user-member', email: 'member@example.com', role: Role.MEMBER };

  assert.equal(requireMembership(adminSession).role, Role.ADMIN);
  assert.equal(requireMembership(adminSession, [Role.ADMIN]).role, Role.ADMIN);
  assert.equal(requirePermission(adminSession, Permission.MANAGE_WORKFLOWS).role, Role.ADMIN);
  assert.throws(() => requirePermission(memberSession, Permission.PUBLISH_CONTENT), /Requires publish content permission/);
  assert.throws(() => requireRole(adminSession, [Role.OWNER]), /Requires OWNER role/);
  assert.throws(() => requireRole({ ...adminSession, orgId: '' }, [Role.ADMIN]), /Unauthorized/);
});

test('tenant access guard blocks cross-tenant access', () => {
  assert.throws(() => assertTenantAccess('org-a', 'org-b'), /Attempted cross-tenant/);
  assert.throws(() => assertTenantAccess('org-a', undefined), /No active organization/);
  assert.doesNotThrow(() => assertTenantAccess('org-a', 'org-a'));
});

test('external Clerk tokens are not accepted as internal sessions', () => {
  const originalProvider = process.env.AUTH_PROVIDER;

  try {
    process.env.AUTH_PROVIDER = 'clerk';

    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'user-clerk-1',
        org_id: 'org-clerk-tenant',
        role: 'admin',
        email: 'clerk@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');

    const signingInput = `${header}.${payload}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signingInput)
      .sign(privateKey)
      .toString('base64url');

    const validToken = `${signingInput}.${signature}`;
    const parsed = parseSession({ authorization: `Bearer ${validToken}` });
    assert.equal(parsed, null);

    process.env.AUTH_PROVIDER = 'custom';
    assert.equal(parseSession({ authorization: `Bearer ${validToken}` }), null);
  } finally {
    if (originalProvider === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = originalProvider;

  }
});

test('organization membership checks verify DB-backed role membership', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);

  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-tenant-d', role: Role.ADMIN },
      { id: 'm-2', organizationId: 'org-other', role: Role.MEMBER }
    ];

    await assertOrganizationMembership('user-999', 'org-tenant-d', [Role.ADMIN, Role.OWNER]);

    await assert.rejects(
      () => assertOrganizationMembership('user-999', 'org-tenant-d', [Role.OWNER]),
      /Requires OWNER role in this organization/
    );

    const memberships = await listUserOrganizations('user-999');
    assert.equal(memberships.length, 2);

    const resolved = await resolveActiveOrganization('user-999', 'org-tenant-d', [Role.ADMIN, Role.OWNER]);
    assert.equal(resolved.organizationId, 'org-tenant-d');
    assert.equal(resolved.role, Role.ADMIN);
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('active session guard rejects a token after it has been revoked', async () => {
  const originalFindUnique = prisma.revokedSession.findUnique.bind(prisma.revokedSession);
  const token = signSessionToken({
    userId: 'user-revoked',
    email: 'revoked@example.com',
    orgId: 'org-revoked',
    role: Role.ADMIN
  });

  try {
    prisma.revokedSession.findUnique = (async () => ({ tokenHash: 'revoked' })) as typeof prisma.revokedSession.findUnique;
    await assert.rejects(
      () => requireActiveSession({ authorization: `Bearer ${token}` }),
      /session has been revoked/
    );
  } finally {
    prisma.revokedSession.findUnique = originalFindUnique;
  }
});

test('authenticated org and permission guards use the current database role', async () => {
  const originalMembershipFindUnique = prisma.membership.findUnique.bind(prisma.membership);
  const originalRevokedFindUnique = prisma.revokedSession.findUnique.bind(prisma.revokedSession);
  const token = signSessionToken({
    userId: 'user-demoted',
    email: 'demoted@example.com',
    orgId: 'org-demoted',
    role: Role.ADMIN
  });
  const headers = { authorization: `Bearer ${token}` };

  try {
    prisma.revokedSession.findUnique = (async () => null) as typeof prisma.revokedSession.findUnique;
    prisma.membership.findUnique = (async () => ({ role: Role.MEMBER })) as typeof prisma.membership.findUnique;

    const { session, role } = await requireAuthenticatedOrg(headers);
    assert.equal(role, Role.MEMBER);
    assert.equal(session.role, Role.MEMBER);
    await assert.rejects(
      () => requireAuthenticatedPermission(headers, Permission.MANAGE_WORKFLOWS),
      /Requires manage workflows permission/
    );
  } finally {
    prisma.membership.findUnique = originalMembershipFindUnique;
    prisma.revokedSession.findUnique = originalRevokedFindUnique;
  }
});
