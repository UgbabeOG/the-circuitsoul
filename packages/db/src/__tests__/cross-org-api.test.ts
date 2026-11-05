import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma, assertOrganizationMembership } from '../index';

test('P0: Role hierarchy - OWNER and ADMIN satisfy MEMBER requirement', async () => {
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
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('P0: Cross-org membership denied - user from org-a cannot access org-b', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.ADMIN }
    ];
    await assert.rejects(
      assertOrganizationMembership('user-1', 'org-b', [Role.ADMIN]),
      /not available to this user/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('P0: Missing membership denied - user with no memberships rejected', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [];
    await assert.rejects(
      assertOrganizationMembership('user-1', 'org-a', [Role.MEMBER]),
      /no active organization memberships/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('P0: Revoked membership denied - membership record removed', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
    prisma.membership.findMany = async () => [];
    await assert.rejects(
      assertOrganizationMembership('user-1', 'org-a', [Role.MEMBER]),
      /no active organization memberships/
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});

test('P0: Role change reflected - stale role claims not trusted, DB role is authoritative', async () => {
  const originalFindMany = prisma.membership.findMany.bind(prisma.membership);
  try {
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
    await assert.doesNotReject(
      assertOrganizationMembership('user-1', 'org-a', [Role.ADMIN])
    );
  } finally {
    prisma.membership.findMany = originalFindMany;
  }
});
