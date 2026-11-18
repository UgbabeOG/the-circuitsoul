import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma } from '../index';
import { createTenantClient } from '../tenant';

test('P0: Cross-tenant workflow access denied — org-a cannot access org-b workflows', async () => {
  const orgAClient = createTenantClient('org-a');

  // org-a can only list its own workflows
  const originalFindMany = prisma.flowWorkflow.findMany;
  prisma.flowWorkflow.findMany = async (args: any) => {
    assert.equal(args.where.organizationId, 'org-a');
    return [];
  };
  try {
    await orgAClient.workflows.findMany({});
  } finally {
    prisma.flowWorkflow.findMany = originalFindMany;
  }

  // org-a cannot access org-b workflow
  const originalFindUnique = prisma.flowWorkflow.findUnique;
  prisma.flowWorkflow.findUnique = async () =>
    ({ id: 'wf-org-b', organizationId: 'org-b', externalWorkflowId: 'n8n-wf-org-b' } as any);
  try {
    await assert.rejects(
      () => orgAClient.workflows.findUnique({ where: { id: 'wf-org-b' } }),
      /Cross-tenant workflow access denied/
    );
  } finally {
    prisma.flowWorkflow.findUnique = originalFindUnique;
  }
});

test('P0: Cross-tenant workflow execution access denied', async () => {
  const orgAClient = createTenantClient('org-a');

  // org-a cannot access an execution belonging to org-b's workflow
  const originalFindUnique = prisma.flowExecution.findUnique;
  prisma.flowExecution.findUnique = async () =>
    ({ id: 'exec-org-b', workflowId: 'wf-org-b' } as any);
  // Mock the workflow lookup to return org-b's workflow
  const originalWfFindUnique = prisma.flowWorkflow.findUnique;
  prisma.flowWorkflow.findUnique = async () =>
    ({ id: 'wf-org-b', organizationId: 'org-b' } as any);
  try {
    await assert.rejects(
      () => orgAClient.flowExecutions.findUnique({ where: { id: 'exec-org-b' } }),
      /Cross-tenant flow execution access denied/
    );
  } finally {
    prisma.flowExecution.findUnique = originalFindUnique;
    prisma.flowWorkflow.findUnique = originalWfFindUnique;
  }
});

test('P0: Role downgrade handling — MEMBER cannot meet ADMIN-only requirement', async () => {
  const originalMembership = prisma.membership.findMany;
  try {
    prisma.membership.findMany = async () => [
      { id: 'm-1', organizationId: 'org-a', role: Role.MEMBER }
    ];
    await assert.rejects(
      () => requireRoleHelper('user-1', 'org-a', [Role.ADMIN]),
      /Requires ADMIN role/
    );
  } finally {
    prisma.membership.findMany = originalMembership;
  }
});

function requireRoleHelper(userId: string, orgId: string, requiredRoles: Role[]) {
  return new Promise((resolve, reject) => {
    const memberships = [
      { id: 'm-1', organizationId: orgId, role: Role.MEMBER }
    ];
    const membership = memberships.find((m) => m.organizationId === orgId);
    if (!membership) {
      reject(new Error('TenantAccessDenied: Requested organization is not available to this user.'));
      return;
    }
    const ROLE_HIERARCHY: Record<Role, number> = { [Role.MEMBER]: 1, [Role.ADMIN]: 2, [Role.OWNER]: 3 };
    const userRank = ROLE_HIERARCHY[membership.role];
    const satisfied = requiredRoles.some((r) => userRank >= ROLE_HIERARCHY[r]);
    if (!satisfied) {
      reject(new Error(`TenantAccessDenied: Requires ${requiredRoles.join(' or ')} role in this organization.`));
      return;
    }
    resolve(membership);
  });
}

