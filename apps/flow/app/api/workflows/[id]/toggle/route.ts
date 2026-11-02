import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.MANAGE_WORKFLOWS);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.ADMIN, Role.OWNER]);
    const workflowId = params.id;
    const body = await request.json();
    const newStatus: 'ACTIVE' | 'INACTIVE' = body.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

    const existingWorkflow = await prisma.flowWorkflow.findFirst({
      where: { id: workflowId, organizationId: session.orgId }
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    const result = await flowAdapter.toggleWorkflowStatus(workflowId, newStatus);

    await prisma.flowWorkflow.updateMany({
      where: { id: workflowId, organizationId: session.orgId },
      data: { status: newStatus }
    });

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle workflow status' },
      { status: 500 }
    );
  }
}
