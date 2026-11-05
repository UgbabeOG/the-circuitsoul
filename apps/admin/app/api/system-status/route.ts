import { NextResponse } from 'next/server';
import { prisma } from '@circuitsoul/db';
import { requirePlatformAdmin } from '../../../lib/platform-admin';

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(Object.fromEntries(request.headers.entries()));

    const [orgCount, userCount, membershipCount, environmentCount, workflowCount, assessmentCount] =
      await Promise.all([
        prisma.organization.count(),
        prisma.user.count(),
        prisma.membership.count(),
        prisma.cloudEnvironment.count(),
        prisma.flowWorkflow.count(),
        prisma.shieldAssessment.count()
      ]);

    const environmentsByStatus = await prisma.cloudEnvironment.groupBy({
      by: ['status'],
      _count: true
    });

    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json({
      success: true,
      system: {
        organizations: orgCount,
        users: userCount,
        memberships: membershipCount,
        environments: environmentCount,
        workflows: workflowCount,
        assessments: assessmentCount
      },
      environmentsByStatus,
      recentActivity,
      serverTime: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch system status' },
      { status: 500 }
    );
  }
}
