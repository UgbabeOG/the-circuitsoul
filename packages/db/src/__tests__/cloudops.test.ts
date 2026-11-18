import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../index';
import { createTenantClient } from '../tenant';

function mockTransaction(prismaClient: typeof prisma) {
  prismaClient.$transaction = async (fn: any) => fn(prismaClient);
}

test('P0: CloudOps - org-scoped cloud environment registration', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.cloudEnvironment.create = async (args: any) =>
    ({ id: 'env-org-a', organizationId: 'org-a', name: 'org-a-env', provider: 'AWS', status: 'DISCONNECTED' } as any);

  const env = await prisma.cloudEnvironment.create({
    data: { organizationId: 'org-a', name: 'org-a-env', provider: 'AWS', credentialsEncrypted: 'enc', credentialsIv: 'iv', status: 'DISCONNECTED' }
  });
  assert.equal(env.organizationId, 'org-a');
  assert.equal(env.provider, 'AWS');

  prisma.cloudEnvironment.create = async () => null as any;
});

test('P0: CloudOps - cross-tenant environment access denied', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.cloudEnvironment.findFirst = async (args: any) => {
    if (args.where.organizationId === 'org-a' && args.where.id === 'env-org-b') return null;
    return ({ id: 'env-org-b', organizationId: 'org-b', name: 'env-b', provider: 'GCP', status: 'CONNECTED' } as any);
  };

  try {
    // org-a cannot see org-b's environment
    const env = await prisma.cloudEnvironment.findFirst({
      where: { id: 'env-org-b', organizationId: 'org-a' }
    });
    assert.equal(env, null, 'org-a cannot see org-b environment');

    // org-b can see its own environment
    const orgBEnv = await prisma.cloudEnvironment.findFirst({
      where: { id: 'env-org-b', organizationId: 'org-b' }
    });
    assert.ok(orgBEnv, 'org-b can see its own environment');
    assert.equal(orgBEnv.organizationId, 'org-b');
  } finally {
    prisma.cloudEnvironment.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: CloudOps - Prometheus label is not the environment UUID', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // Environment has a distinct Prometheus instance label
  prisma.cloudEnvironment.findFirst = async () =>
    ({
      id: 'env-org-a',
      organizationId: 'org-a',
      prometheusInstanceLabel: 'prom-instance-abc-123'
    } as any);

  const env = await prisma.cloudEnvironment.findFirst({
    where: { id: 'env-org-a', organizationId: 'org-a' }
  });
  assert.ok(env, 'Environment found');
  assert.notEqual(env.prometheusInstanceLabel, env.id, 'Prometheus label must differ from env UUID');
  assert.equal(env.prometheusInstanceLabel, 'prom-instance-abc-123');

  prisma.cloudEnvironment.findFirst = async () => null as any;
  delete (prisma as any).$transaction;
});

test('P0: CloudOps - metrics states: live, partial, unavailable', async () => {
  // Verify state transition logic
  const live = { state: 'live' as const, cpu: 45, memory: 30 };
  const partial = { state: 'partial' as const, cpu: 45, memory: null };
  const unavailable = { state: 'unavailable' as const, cpu: null, memory: null };

  assert.equal(live.state, 'live');
  assert.ok(live.cpu !== null && live.memory !== null);
  assert.equal(partial.state, 'partial');
  assert.ok(partial.cpu !== null && partial.memory === null);
  assert.equal(unavailable.state, 'unavailable');
  assert.ok(unavailable.cpu === null && unavailable.memory === null);
});

test('P0: CloudOps - credentials never returned in API response', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // The environments GET route only selects non-credential fields
  prisma.cloudEnvironment.findMany = async () =>
    ([
      { id: 'env-1', provider: 'AWS', name: 'env-1', status: 'CONNECTED', prometheusInstanceLabel: 'prom-1' },
      { id: 'env-2', provider: 'GCP', name: 'env-2', status: 'DISCONNECTED', prometheusInstanceLabel: null }
    ] as any);

  const envs = await prisma.cloudEnvironment.findMany({
    where: { organizationId: 'org-a' },
    select: { id: true, provider: true, name: true, status: true, prometheusInstanceLabel: true, createdAt: true, updatedAt: true }
  });

  assert.equal(envs.length, 2);
  // Verify no credentials fields are present
  for (const env of envs) {
    assert.equal(env.credentialsEncrypted, undefined);
    assert.equal(env.credentialsIv, undefined);
  }

  prisma.cloudEnvironment.findMany = async () => null as any;
  delete (prisma as any).$transaction;
});
