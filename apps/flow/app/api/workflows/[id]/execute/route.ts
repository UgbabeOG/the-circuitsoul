import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, Role, assertOrganizationMembership, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.MANAGE_WORKFLOWS);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);

    // Enforce entitlement before workflow execution
    await enforceEntitlement(session.orgId, 'WORKFLOW_EXECUTION');

    const workflowId = params.id;
    const body = await request.json().catch(() => ({}));
    const payload = body.payload || {};
    const triggerSource = body.triggerSource || 'CIRCUITSOUL_FLOW_UI';

    const dbWorkflow = await prisma.flowWorkflow.findFirst({
      where: { id: workflowId, organizationId: session.orgId }
    });

    if (!dbWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    const externalWorkflowId = dbWorkflow.externalWorkflowId;
    if (!externalWorkflowId) {
      return NextResponse.json(
        { success: false, error: 'Workflow has no external engine mapping; cannot execute' },
        { status: 400 }
      );
    }

    const execution = await flowAdapter.triggerWorkflow(
      externalWorkflowId,
      payload,
      triggerSource
    );

    await recordUsage({
      organizationId: session.orgId,
      eventType: 'WORKFLOW_EXECUTION',
      jobsExecuted: 1,
      generationMs: execution.durationMs || 500,
      rawPayload: {
        workflowId: dbWorkflow.id,
        externalWorkflowId,
        executionId: execution.id,
        triggerSource
      }
    });

    await prisma.flowExecution.create({
      data: {
        workflowId: dbWorkflow.id,
        status: execution.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        completedAt: new Date(),
        logsJson: JSON.stringify(execution.output)
      }
    });

    return NextResponse.json({
      success: true,
      execution,
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Execution failed' },
      { status: 500 }
    );
  }
}
