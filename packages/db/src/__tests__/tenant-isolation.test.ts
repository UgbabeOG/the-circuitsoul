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

test('assertTenantAccess blocks cross-tenant data access', () => {
  assert.throws(() => assertTenantAccess('org-a', 'org-b'), /cross-tenant/);
  assert.throws(() => assertTenantAccess('org-a', undefined), /No active organization/);
  assert.doesNotThrow(() => assertTenantAccess('org-a', 'org-a'));
});

test('assertTenantAccess rejects null resource org id', () => {
  assert.throws(() => assertTenantAccess(null, 'org-a'), /cross-tenant/);
});

test('createTenantClient scopes all queries to the organization', async () => {
  const orgId = 'org-tenant-x';
  const client = createTenantClient(orgId);

  // Mock all prisma model methods to capture arguments and return empty results
  const models = [
    'asset', 'shieldAssessment', 'nDPRAssessment', 'securityConsultingRequest',
    'flowWorkflow', 'subscription', 'cloudEnvironment', 'blogPost',
    'aiGeneration', 'notification', 'activityLog'
  ];

  const originalMethods: Record<string, any> = {};
  const capturedArgs: Record<string, any> = {};

  try {
    for (const model of models) {
      originalMethods[model] = prisma[model as keyof typeof prisma];
      capturedArgs[model] = null;

      (prisma as any)[model] = (() => {
        const mock: any = {
          findMany: async (args: any = {}) => {
            capturedArgs[model] = args;
            return [];
          },
          findUnique: async (args: any) => {
            capturedArgs[model] = args;
            return null;
          },
          create: async (args: any) => {
            capturedArgs[model] = args;
            return { id: 'test-id', ...args.data, organizationId: orgId };
          }
        };
        return mock;
      })();
    }

    // assets.findMany should include organizationId in where
    await client.assets.findMany({ where: { status: 'active' } });
    assert.ok(capturedArgs.asset.where.organizationId === orgId);
    assert.ok(capturedArgs.asset.where.status === 'active');

    // assessments.create should include organizationId in data
    await client.assessments.create({ data: { name: 'test', score: 90 } });
    assert.ok(capturedArgs.shieldAssessment.data.organizationId === orgId);
    assert.ok(capturedArgs.shieldAssessment.data.name === 'test');

    // workflows.create should include organizationId in data
    await client.workflows.create({ data: { name: 'wf-1', status: 'DRAFT' } });
    assert.ok(capturedArgs.flowWorkflow.data.organizationId === orgId);

    // subscriptions.create should include organizationId in data
    await client.subscriptions.create({ data: { planId: 'plan-1', status: 'ACTIVE' } });
    assert.ok(capturedArgs.subscription.data.organizationId === orgId);

    // cloudEnvironments.create should include organizationId in data
    await client.cloudEnvironments.create({ data: { name: 'env-1', provider: 'AWS' } });
    assert.ok(capturedArgs.cloudEnvironment.data.organizationId === orgId);

    // blogPosts.create should include organizationId in data
    await client.blogPosts.create({ data: { title: 'post-1', content: 'hello', authorId: 'user-1' } });
    assert.ok(capturedArgs.blogPost.data.organizationId === orgId);

    // aiGenerations.create should include organizationId in data
    await client.aiGenerations.create({ data: { userId: 'user-1', prompt: 'hi', response: 'hello', tokenCount: 10, type: 'BLOG_CONTENT' } });
    assert.ok(capturedArgs.aiGeneration.data.organizationId === orgId);

    // notifications.create should include organizationId in data
    await client.notifications.create({ data: { title: 'alert', message: 'test' } });
    assert.ok(capturedArgs.notification.data.organizationId === orgId);

    // activityLogs.create should include organizationId in data
    await client.activityLogs.create({ data: { action: 'login', userId: 'user-1' } });
    assert.ok(capturedArgs.activityLog.data.organizationId === orgId);
  } finally {
    for (const model of models) {
      (prisma as any)[model] = originalMethods[model];
    }
  }
});

test('createTenantClient findUnique rejects cross-tenant access', async () => {
  const orgId = 'org-tenant-x';
  const client = createTenantClient(orgId);

  // Mock prisma to return a resource from a different org
  const originalFindUnique = prisma.asset.findUnique.bind(prisma.asset);
  try {
    prisma.asset.findUnique = async () =>
      ({ id: 'asset-1', organizationId: 'org-tenant-y', name: 'foreign-asset' } as any);

    await assert.rejects(
      () => client.assets.findUnique({ where: { id: 'asset-1' } }),
      /Cross-tenant asset access denied/
    );
  } finally {
    prisma.asset.findUnique = originalFindUnique;
  }
});

test('createTenantClient findUnique allows same-tenant access', async () => {
  const orgId = 'org-tenant-x';
  const client = createTenantClient(orgId);

  const originalFindUnique = prisma.asset.findUnique.bind(prisma.asset);
  try {
    prisma.asset.findUnique = async () =>
      ({ id: 'asset-1', organizationId: orgId, name: 'own-asset' } as any);

    const result = await client.assets.findUnique({ where: { id: 'asset-1' } });
    assert.ok(result);
    assert.equal(result.organizationId, orgId);
  } finally {
    prisma.asset.findUnique = originalFindUnique;
  }
});

test('resolveActiveOrganization requires explicit organizationId', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-tenant-d', role: Role.ADMIN }
    ];

    await assert.rejects(
      () => resolveActiveOrganization('user-999', undefined),
      /Organization ID must be explicitly provided/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('resolveActiveOrganization rejects organization not in user memberships', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-tenant-d', role: Role.MEMBER }
    ];

    await assert.rejects(
      () => resolveActiveOrganization('user-999', 'org-tenant-other'),
      /not available to this user/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('assertOrganizationMembership rejects insufficient role', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-tenant-d', role: Role.MEMBER }
    ];

    await assert.rejects(
      () => assertOrganizationMembership('user-999', 'org-tenant-d', [Role.OWNER, Role.ADMIN]),
      /Requires OWNER or ADMIN role/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});
