import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma } from '../index';
import {
  assertOrganizationMembership,
  assertTenantAccess,
  createTenantClient,
  resolveActiveOrganization
} from '../tenant';

function makeSessionHeaders(orgId: string, userId: string, role: Role): Record<string, string> {
  const token = Buffer.from(
    JSON.stringify({ userId, email: `${userId}@test.com`, orgId, role, exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString('base64url');
  return {
    'x-circuitsoul-session': `${token}.sig`
  };
}

test('assertOrganizationMembership uses role hierarchy: OWNER >= ADMIN >= MEMBER', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.OWNER }
    ];
    await assert.doesNotReject(
      assertOrganizationMembership('user-1', 'org-a', [Role.MEMBER])
    );

    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.ADMIN }
    ];
    await assert.doesNotReject(
      assertOrganizationMembership('user-1', 'org-a', [Role.MEMBER])
    );

    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.MEMBER }
    ];
    await assert.rejects(
      assertOrganizationMembership('user-1', 'org-a', [Role.ADMIN]),
      /Requires ADMIN role/
    );

    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.ADMIN }
    ];
    await assert.rejects(
      assertOrganizationMembership('user-1', 'org-a', [Role.OWNER]),
      /Requires OWNER role/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('createTenantClient scopes queries to the organization and rejects cross-tenant access', async () => {
  const orgId = 'org-tenant-a';
  const client = createTenantClient(orgId);

  const originalAssetFindMany = prisma.asset.findMany.bind(prisma.asset);
  const originalAssetFindUnique = prisma.asset.findUnique.bind(prisma.asset);
  try {
    let capturedWhere: any = null;
    prisma.asset.findMany = async (args: any) => {
      capturedWhere = args.where;
      return [];
    };
    await client.assets.findMany({ where: { status: 'active' } });
    assert.ok(capturedWhere.organizationId === orgId);
    assert.ok(capturedWhere.status === 'active');

    prisma.asset.findUnique = async () =>
      ({ id: 'asset-1', organizationId: 'org-tenant-b', name: 'foreign-asset' } as any);
    await assert.rejects(
      () => client.assets.findUnique({ where: { id: 'asset-1' } }),
      /Cross-tenant asset access denied/
    );

    prisma.asset.findUnique = async () =>
      ({ id: 'asset-1', organizationId: orgId, name: 'own-asset' } as any);
    const result = await client.assets.findUnique({ where: { id: 'asset-1' } });
    assert.ok(result);
    assert.equal(result.organizationId, orgId);
  } finally {
    prisma.asset.findMany = originalAssetFindMany;
    prisma.asset.findUnique = originalAssetFindUnique;
  }
});

test('resolveActiveOrganization rejects organization not in user memberships (cross-org)', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-tenant-a', role: Role.ADMIN }
    ];
    await assert.rejects(
      () => resolveActiveOrganization('user-999', 'org-tenant-b', [Role.ADMIN]),
      /not available to this user/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('assertTenantAccess blocks cross-tenant data access', () => {
  assert.throws(() => assertTenantAccess('org-a', 'org-b'), /cross-tenant/);
  assert.throws(() => assertTenantAccess('org-a', undefined), /No active organization/);
  assert.throws(() => assertTenantAccess(null, 'org-a'), /cross-tenant/);
  assert.doesNotThrow(() => assertTenantAccess('org-a', 'org-a'));
});
