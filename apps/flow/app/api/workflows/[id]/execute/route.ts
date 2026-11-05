import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { z } from 'zod';

const ExecuteSchema = z.object({
  payload: z.record(z.unknown()).default({}),
  triggerSource: z.string().min(1).max(64).default('CIRCUITSOUL_FLOW_UI')
}).strict();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_WORKFLOWS
    );

    // Enforce entitlement before workflow execution
    await enforceEntitlement(session.orgId, 'WORKFLOW_EXECUTION');

    const workflowId = params.id;
    const parsedBody = ExecuteSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error.issues[0]?.message || 'Invalid execution request' },
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
    if (dbWorkflow.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Only active workflows can be executed' },
        { status: 409 }
      );
    }

    const externalWorkflowId = dbWorkflow.externalWorkflowId;
    if (!externalWorkflowId) {
      return NextResponse.json(
        { success: false, error: 'Workflow has no external engine mapping; cannot execute' },
        { status: 400 }
      );
    }

    const executionRecord = await prisma.flowExecution.create({
      data: { workflowId: dbWorkflow.id, status: 'RUNNING' }
    });
    const startedAt = Date.now();
    let execution;
    try {
      execution = await flowAdapter.triggerWorkflow(
        externalWorkflowId,
        parsedBody.data.payload,
        parsedBody.data.triggerSource
      );
    } catch (error) {
      await prisma.flowExecution.update({
        where: { id: executionRecord.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          logsJson: JSON.stringify({ error: error instanceof Error ? error.message : 'Engine request failed' })
        }
      });
      return NextResponse.json(
        { success: false, error: 'Workflow engine execution failed', executionId: executionRecord.id },
        { status: 502 }
      );
    }

    await prisma.flowExecution.update({
      where: { id: executionRecord.id },
      data: {
        status: execution.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
        completedAt: new Date(),
        logsJson: JSON.stringify(execution.output)
      }
    });
    await recordUsage({
      organizationId: session.orgId,
      eventType: 'WORKFLOW_EXECUTION',
      jobsExecuted: 1,
      generationMs: Date.now() - startedAt,
      rawPayload: {
        workflowId: dbWorkflow.id,
        externalWorkflowId,
        executionId: execution.id,
        triggerSource: parsedBody.data.triggerSource
      }
    });

    return NextResponse.json({
      success: true,
      execution,
      executionId: executionRecord.id,
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}
