import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { z } from 'zod';

const MAX_RETRIES = 3;

const RetrySchema = z.object({
  payload: z.record(z.unknown()).default({}),
  triggerSource: z.string().min(1).max(64).default('CIRCUITSOUL_FLOW_RETRY')
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; execId: string }> }
) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_WORKFLOWS
    );

    // Enforce entitlement before workflow execution retry
    await enforceEntitlement(session.orgId, 'WORKFLOW_EXECUTION');

    const { id: workflowId, execId } = await params;
    const parsedBody = RetrySchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: parsedBody.error.issues[0]?.message || 'Invalid retry request' },
        { status: 400 }
      );
    }

    // Verify the workflow belongs to the org
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
        { success: false, error: 'Only active workflows can be retried' },
        { status: 409 }
      );
    }

    const externalWorkflowId = dbWorkflow.externalWorkflowId;
    if (!externalWorkflowId) {
      return NextResponse.json(
        { success: false, error: 'Workflow has no external engine mapping; cannot retry' },
        { status: 400 }
      );
    }

    // Verify the execution exists and belongs to this workflow
    const existingExecution = await prisma.flowExecution.findFirst({
      where: { id: execId, workflowId: dbWorkflow.id }
    });

    if (!existingExecution) {
      return NextResponse.json(
        { success: false, error: 'Execution not found or does not belong to this workflow' },
        { status: 404 }
      );
    }

    // Only FAILED executions can be retried
    if (existingExecution.status !== 'FAILED') {
      return NextResponse.json(
        { success: false, error: `Cannot retry execution with status ${existingExecution.status}. Only FAILED executions can be retried.` },
        { status: 409 }
      );
    }

    // Check retry limit
    if (existingExecution.retryCount >= MAX_RETRIES) {
      return NextResponse.json(
        {
          success: false,
          error: `Maximum retry limit (${MAX_RETRIES}) reached for this execution`,
          retryCount: existingExecution.retryCount
        },
        { status: 409 }
      );
    }

    // Mark the old execution as superseded (still FAILED, but with retry info)
    await prisma.flowExecution.update({
      where: { id: execId },
      data: {
        logsJson: JSON.stringify({
          ...(existingExecution.logsJson ? JSON.parse(existingExecution.logsJson) : {}),
          supersededBy: 'retry',
          retriedAt: new Date().toISOString()
        })
      }
    });

    // Create a new execution record for the retry attempt
    const newExecutionRecord = await prisma.flowExecution.create({
      data: {
        workflowId: dbWorkflow.id,
        status: 'RUNNING',
        retryCount: existingExecution.retryCount + 1
      }
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
        where: { id: newExecutionRecord.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          logsJson: JSON.stringify({ error: error instanceof Error ? error.message : 'Engine request failed', retryCount: existingExecution.retryCount + 1 })
        }
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow engine execution failed',
          executionId: newExecutionRecord.id,
          retryCount: existingExecution.retryCount + 1
        },
        { status: 502 }
      );
    }

    await prisma.flowExecution.update({
      where: { id: newExecutionRecord.id },
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
        executionId: newExecutionRecord.id,
        triggerSource: parsedBody.data.triggerSource,
        isRetry: true,
        retryCount: existingExecution.retryCount + 1
      }
    });

    return NextResponse.json({
      success: true,
      execution,
      executionId: newExecutionRecord.id,
      retryCount: existingExecution.retryCount + 1,
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
      { success: false, error: error instanceof Error ? error.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
