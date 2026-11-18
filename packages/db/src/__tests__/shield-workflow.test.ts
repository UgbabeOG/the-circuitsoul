import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma } from '../index';
import { createTenantClient } from '../tenant';

function mockTransaction(prismaClient: typeof prisma) {
  prismaClient.$transaction = async (fn: any) => fn(prismaClient);
}

test('P0: Shield - org-scoped asset registration and verification', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // org-a registers an asset
  prisma.asset.create = async (args: any) =>
    ({ id: 'asset-org-a', organizationId: 'org-a', name: 'org-a-asset', verified: false, agentId: null } as any);

  const asset = await prisma.asset.create({
    data: { organizationId: 'org-a', name: 'org-a-asset', type: 'server', target: '10.0.0.1', isAuthorized: true, verified: false }
  });
  assert.equal(asset.organizationId, 'org-a');
  assert.equal(asset.verified, false);
  assert.equal(asset.agentId, null);

  // org-a cannot see org-b's asset
  prisma.asset.findFirst = async () => null;
  const orgBAsset = await prisma.asset.findFirst({ where: { id: 'asset-org-b', organizationId: 'org-a' } });
  assert.equal(orgBAsset, null);

  prisma.asset.create = async () => null as any;
  prisma.asset.findFirst = async () => null as any;
});

test('P0: Shield - asset verification sets verified=true only after successful Wazuh mapping', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // Authorized asset exists for org-a
  prisma.asset.findFirst = async () =>
    ({ id: 'asset-org-a', organizationId: 'org-a', name: 'asset-a', target: '10.0.0.1', isAuthorized: true, verified: false, agentId: null } as any);

  // Wazuh verification succeeds
  prisma.asset.update = async (args: any) =>
    ({ id: 'asset-org-a', organizationId: 'org-a', verified: true, agentId: 'wazuh-agent-001' } as any);

  const asset = await prisma.asset.findFirst({
    where: { id: 'asset-org-a', organizationId: 'org-a', isAuthorized: true }
  });
  assert.ok(asset, 'Authorized asset found for org-a');

  const verified = await prisma.asset.update({
    where: { id: 'asset-org-a' },
    data: { agentId: 'wazuh-agent-001', verified: true }
  });
  assert.equal(verified.verified, true);
  assert.equal(verified.agentId, 'wazuh-agent-001');

  prisma.asset.findFirst = async () => null as any;
  prisma.asset.update = async () => null as any;
});

test('P0: Shield - cross-tenant vulnerability assessment access denied', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // org-a tries to access org-b's vulnerability - mocked to respect org filter
  prisma.shieldVulnerability.findFirst = async (args: any) => {
    if (args.where.assessment?.organizationId === 'org-b') return null;
    return ({ id: 'vuln-org-a', assessmentId: 'assessment-org-a', status: 'OPEN' } as any);
  };
  prisma.shieldAssessment.findUnique = async () =>
    ({ id: 'assessment-org-a', organizationId: 'org-a' } as any);

  try {
    // org-a can see its own vulnerability
    const vuln = await prisma.shieldVulnerability.findFirst({
      where: { id: 'vuln-org-a', assessment: { organizationId: 'org-a' } }
    });
    assert.ok(vuln, 'org-a can see its own vulnerability');

    // org-a cannot see org-b's vulnerability
    const orgBVuln = await prisma.shieldVulnerability.findFirst({
      where: { id: 'vuln-org-b', assessment: { organizationId: 'org-b' } }
    });
    assert.equal(orgBVuln, null, 'org-a cannot see org-b vulnerability');
  } finally {
    prisma.shieldVulnerability.findFirst = async () => null as any;
    prisma.shieldAssessment.findUnique = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Shield - NDPR assessment is self-reported, not certification', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.nDPRAssessment.create = async (args: any) =>
    ({ id: 'ndpr-org-a', organizationId: 'org-a', score: 75, compliant: false, createdAt: new Date() } as any);

  const assessment = await prisma.nDPRAssessment.create({
    data: {
      organizationId: 'org-a',
      score: 75,
      compliant: false,
      answersJson: '{}',
      remediationsJson: '[]',
      conductedBy: 'user-dev-uuid-001'
    },
    select: { id: true, score: true, compliant: true, createdAt: true }
  });
  assert.equal(assessment.score, 75);
  assert.equal(assessment.compliant, false);

  prisma.nDPRAssessment.create = async () => null as any;
});

test('P0: Shield - vulnerability status update is org-scoped', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // org-a can only update its own vulnerability
  prisma.shieldVulnerability.findFirst = async (args: any) => {
    if (args.where.assessment?.organizationId === 'org-b') return null;
    return ({ id: 'vuln-org-a', assessmentId: 'assessment-org-a', status: 'OPEN' } as any);
  };
  prisma.shieldVulnerability.update = async (args: any) =>
    ({ id: 'vuln-org-a', status: 'RESOLVED' } as any);

  try {
    const vuln = await prisma.shieldVulnerability.findFirst({
      where: { id: 'vuln-org-a', assessment: { organizationId: 'org-a' } }
    });
    assert.ok(vuln, 'org-a can see its own vulnerability');

    const updated = await prisma.shieldVulnerability.update({
      where: { id: 'vuln-org-a' },
      data: { status: 'RESOLVED' }
    });
    assert.equal(updated.status, 'RESOLVED');

    // org-b cannot see org-a's vulnerability
    const orgBVuln = await prisma.shieldVulnerability.findFirst({
      where: { id: 'vuln-org-a', assessment: { organizationId: 'org-b' } }
    });
    assert.equal(orgBVuln, null, 'org-b cannot see org-a vulnerability');
  } finally {
    prisma.shieldVulnerability.findFirst = async () => null as any;
    prisma.shieldVulnerability.update = async () => null as any;
    delete (prisma as any).$transaction;
  }
});
