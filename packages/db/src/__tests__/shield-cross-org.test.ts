import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma } from '../index';
import {
  assertOrganizationMembership,
  createTenantClient
} from '../tenant';

test('P0: Cross-tenant asset access denied - org-a cannot read org-b assets', async () => {
  const orgAClient = createTenantClient('org-a');
  const orgBClient = createTenantClient('org-b');

  const originalAssetFindMany = prisma.asset.findMany.bind(prisma.asset);
  const originalAssetFindUnique = prisma.asset.findUnique.bind(prisma.asset);

  try {
    // org-a can only see org-a assets
    prisma.asset.findMany = async (args: any) => {
      assert.equal(args.where.organizationId, 'org-a');
      return [];
    };
    await orgAClient.assets.findMany({});
  } finally {
    prisma.asset.findMany = originalAssetFindMany;
  }

  try {
    // org-a accessing org-b asset is rejected
    prisma.asset.findUnique = async () =>
      ({ id: 'asset-org-b', organizationId: 'org-b', name: 'foreign-asset' } as any);
    await assert.rejects(
      () => orgAClient.assets.findUnique({ where: { id: 'asset-org-b' } }),
      /Cross-tenant asset access denied/
    );
  } finally {
    prisma.asset.findUnique = originalAssetFindUnique;
  }

  try {
    // org-b accessing org-a asset is rejected
    prisma.asset.findUnique = async () =>
      ({ id: 'asset-org-a', organizationId: 'org-a', name: 'foreign-asset' } as any);
    await assert.rejects(
      () => orgBClient.assets.findUnique({ where: { id: 'asset-org-a' } }),
      /Cross-tenant asset access denied/
    );
  } finally {
    prisma.asset.findUnique = originalAssetFindUnique;
  }
});

test('P0: Cross-tenant ShieldAssessment access denied', async () => {
  const orgAClient = createTenantClient('org-a');

  const originalAssessmentFindMany = prisma.shieldAssessment.findMany.bind(prisma.shieldAssessment);
  const originalAssessmentFindUnique = prisma.shieldAssessment.findUnique.bind(prisma.shieldAssessment);

  try {
    prisma.shieldAssessment.findMany = async (args: any) => {
      assert.equal(args.where.organizationId, 'org-a');
      return [];
    };
    await orgAClient.assessments.findMany({});
  } finally {
    prisma.shieldAssessment.findMany = originalAssessmentFindMany;
  }

  try {
    prisma.shieldAssessment.findUnique = async () =>
      ({ id: 'assessment-org-b', organizationId: 'org-b' } as any);
    await assert.rejects(
      () => orgAClient.assessments.findUnique({ where: { id: 'assessment-org-b' } }),
      /Cross-tenant assessment access denied/
    );
  } finally {
    prisma.shieldAssessment.findUnique = originalAssessmentFindUnique;
  }
});

test('P0: Cross-tenant NDPR assessment access denied', async () => {
  const orgAClient = createTenantClient('org-a');

  const originalNdprFindMany = prisma.nDPRAssessment.findMany.bind(prisma.nDPRAssessment);
  const originalNdprFindUnique = prisma.nDPRAssessment.findUnique.bind(prisma.nDPRAssessment);

  try {
    prisma.nDPRAssessment.findMany = async (args: any) => {
      assert.equal(args.where.organizationId, 'org-a');
      return [];
    };
    await orgAClient.ndprAssessments.findMany({});
  } finally {
    prisma.nDPRAssessment.findMany = originalNdprFindMany;
  }

  try {
    prisma.nDPRAssessment.findUnique = async () =>
      ({ id: 'ndpr-org-b', organizationId: 'org-b' } as any);
    await assert.rejects(
      () => orgAClient.ndprAssessments.findUnique({ where: { id: 'ndpr-org-b' } }),
      /Cross-tenant NDPR assessment access denied/
    );
  } finally {
    prisma.nDPRAssessment.findUnique = originalNdprFindUnique;
  }
});

test('P0: Role downgrade handling - MEMBER cannot perform ADMIN-only Shield operations', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.MEMBER }
    ];

    // MEMBER role should not satisfy ADMIN requirement
    await assert.rejects(
      () => assertOrganizationMembership('user-1', 'org-a', [Role.ADMIN]),
      /Requires ADMIN role/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});
