import { prisma } from '@circuitsoul/db';
import AdminDashboardClient from './_components/dashboard';

interface AdminDashboardProps {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    members: number;
    assets: number;
    environments: number;
    workflows: number;
    aiGenerations: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  system: {
    organizations: number;
    users: number;
    memberships: number;
    environments: number;
    workflows: number;
    assessments: number;
  };
  environmentsByStatus: Array<{ status: string; _count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user: { id: string; email: string; name: string | null } | null;
    organization: { id: string; name: string } | null;
  }>;
}

export default async function AdminPage() {
  let organizations: AdminDashboardProps['organizations'] = [];
  let system: AdminDashboardProps['system'] = {
    organizations: 0,
    users: 0,
    memberships: 0,
    environments: 0,
    workflows: 0,
    assessments: 0
  };
  let environmentsByStatus: AdminDashboardProps['environmentsByStatus'] = [];
  let recentActivity: AdminDashboardProps['recentActivity'] = [];

  if (process.env.DATABASE_URL) {
    try {
      const [
        orgsResult,
        orgCount,
        userCount,
        membershipCount,
        environmentCount,
        workflowCount,
        assessmentCount,
        envByStatus,
        activityResult
      ] = await Promise.all([
        prisma.organization.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                memberships: true,
                assets: true,
                environments: true,
                workflows: true,
                aiGenerations: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }),
        prisma.organization.count(),
        prisma.user.count(),
        prisma.membership.count(),
        prisma.cloudEnvironment.count(),
        prisma.flowWorkflow.count(),
        prisma.shieldAssessment.count(),
        prisma.cloudEnvironment.groupBy({
          by: ['status'],
          _count: true
        }),
        prisma.activityLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { id: true, email: true, name: true } },
            organization: { select: { id: true, name: true } }
          }
        })
      ]);

      organizations = orgsResult.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        members: org._count.memberships,
        assets: org._count.assets,
        environments: org._count.environments,
        workflows: org._count.workflows,
        aiGenerations: org._count.aiGenerations,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt
      }));
      system = {
        organizations: orgCount,
        users: userCount,
        memberships: membershipCount,
        environments: environmentCount,
        workflows: workflowCount,
        assessments: assessmentCount
      };
      environmentsByStatus = envByStatus;
      recentActivity = activityResult.map((log) => ({
        id: log.id,
        action: log.action,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        user: log.user,
        organization: log.organization
      }));
    } catch {
      // DB unavailable during build - use empty defaults
    }
  }

  return (
    <AdminDashboardClient
      organizations={organizations}
      system={system}
      environmentsByStatus={environmentsByStatus}
      recentActivity={recentActivity}
    />
  );
}
