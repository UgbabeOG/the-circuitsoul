import { Role } from '@prisma/client';
import { prisma } from './index';

/**
 * Tenant Scoping and Isolation Layer
 *
 * Enforces that queries and operations are strictly scoped to the active organization.
 * Prevents horizontal privilege escalation where Tenant A accesses Tenant B data.
 */

const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.MEMBER]: 1,
  [Role.ADMIN]: 2,
  [Role.OWNER]: 3
};

function roleSatisfies(userRole: Role, requiredRoles: Role[]): boolean {
  const userRank = ROLE_HIERARCHY[userRole];
  return requiredRoles.some((r) => userRank >= ROLE_HIERARCHY[r]);
}

export function assertTenantAccess(resourceOrgId: string | null | undefined, sessionOrgId: string | null | undefined): void {
  if (!sessionOrgId) {
    throw new Error('TenantAccessDenied: No active organization session.');
  }
  if (!resourceOrgId || resourceOrgId !== sessionOrgId) {
    throw new Error('TenantAccessDenied: Attempted cross-tenant data access violation.');
  }
}

export async function listUserOrganizations(userId: string | null | undefined): Promise<Array<{ id: string; organizationId: string; role: Role }>> {
  if (!userId) {
    throw new Error('TenantAccessDenied: No active user session.');
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      id: true,
      organizationId: true,
      role: true
    },
    orderBy: { createdAt: 'asc' }
  });

  return memberships;
}

export async function resolveActiveOrganization(
  userId: string | null | undefined,
  requestedOrganizationId: string | null | undefined,
  requiredRoles: Role[] = [Role.MEMBER]
): Promise<{ id: string; organizationId: string; role: Role }> {
  if (!userId) {
    throw new Error('TenantAccessDenied: No active user session.');
  }

  if (!requestedOrganizationId) {
    throw new Error('TenantAccessDenied: Organization ID must be explicitly provided for org switching.');
  }

  const memberships = await listUserOrganizations(userId);
  if (!memberships.length) {
    throw new Error('TenantAccessDenied: User has no active organization memberships.');
  }

  const membership = memberships.find((entry) => entry.organizationId === requestedOrganizationId);
  if (!membership) {
    throw new Error('TenantAccessDenied: Requested organization is not available to this user.');
  }

  if (!roleSatisfies(membership.role, requiredRoles)) {
    const roles = requiredRoles.join(' or ');
    throw new Error(`TenantAccessDenied: Requires ${roles} role in this organization.`);
  }

  return membership;
}

export async function assertOrganizationMembership(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
  requiredRoles: Role[] = [Role.MEMBER]
): Promise<{ role: Role }> {
  const membership = await resolveActiveOrganization(userId, organizationId, requiredRoles);
  return { role: membership.role };
}

/**
 * Returns a tenant-scoped Prisma query context.
 */
export function createTenantClient(organizationId: string) {
  if (!organizationId) {
    throw new Error('Tenant context requires a valid organizationId');
  }

  return {
    assets: {
      findMany: (args: any = {}) =>
        prisma.asset.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.asset.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant asset access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.asset.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    assessments: {
      findMany: (args: any = {}) =>
        prisma.shieldAssessment.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.shieldAssessment.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant assessment access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.shieldAssessment.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    ndprAssessments: {
      findMany: (args: any = {}) =>
        prisma.nDPRAssessment.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      create: (args: any) =>
        prisma.nDPRAssessment.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    consultingRequests: {
      findMany: (args: any = {}) =>
        prisma.securityConsultingRequest.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      create: (args: any) =>
        prisma.securityConsultingRequest.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    workflows: {
      findMany: (args: any = {}) =>
        prisma.flowWorkflow.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.flowWorkflow.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant workflow access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.flowWorkflow.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    subscriptions: {
      findMany: (args: any = {}) =>
        prisma.subscription.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.subscription.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant subscription access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.subscription.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    cloudEnvironments: {
      findMany: (args: any = {}) =>
        prisma.cloudEnvironment.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.cloudEnvironment.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant cloud environment access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.cloudEnvironment.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    blogPosts: {
      findMany: (args: any = {}) =>
        prisma.blogPost.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.blogPost.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant blog post access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.blogPost.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    aiGenerations: {
      findMany: (args: any = {}) =>
        prisma.aiGeneration.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      findUnique: async (args: any) => {
        const item = await prisma.aiGeneration.findUnique(args);
        if (item && item.organizationId !== organizationId) {
          throw new Error('Cross-tenant AI generation access denied');
        }
        return item;
      },
      create: (args: any) =>
        prisma.aiGeneration.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    notifications: {
      findMany: (args: any = {}) =>
        prisma.notification.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      create: (args: any) =>
        prisma.notification.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    },
    activityLogs: {
      findMany: (args: any = {}) =>
        prisma.activityLog.findMany({
          ...args,
          where: { ...args.where, organizationId }
        }),
      create: (args: any) =>
        prisma.activityLog.create({
          ...args,
          data: { ...args.data, organizationId }
        })
    }
  };
}
