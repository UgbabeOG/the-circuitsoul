import { NextResponse } from 'next/server';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');

    if (!workflowId) {
      return NextResponse.json(
        { success: false, error: 'workflowId is required' },
        { status: 400 }
      );
    }

    const dbWorkflow = await prisma.flowWorkflow.findFirst({
      where: { id: workflowId, organizationId: session.orgId }
    });

    if (!dbWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    const executions = await prisma.flowExecution.findMany({
      where: { workflowId: dbWorkflow.id },
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      success: true,
      executions,
      workflowId: dbWorkflow.id,
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}
