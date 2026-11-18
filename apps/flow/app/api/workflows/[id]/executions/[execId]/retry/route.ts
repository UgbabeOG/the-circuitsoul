import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { z } from 'zod';

const MAX_RETRIES = 3;
const IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

const RetrySchema = z.object({
  payload: z.record(z.unknown()).default({}),
  triggerSource: z.string().min(1).max(64).default('CIRCUITSOUL_FLOW_RETRY')
}).strict();

class HttpError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body ?? { success: false, error: message };
  }
}

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

    const idempotencyKey = request.headers.get('idempotency-key') || undefined;

    return await prisma.$transaction(async (tx) => {
      // Idempotency: if a retry with this key was already processed (within window), return it
      if (idempotencyKey) {
        const existing = await tx.flowExecution.findFirst({
          where: {
            workflowId,
            logsJson: { contains: `"idempotencyKey":"${idempotencyKey}"` },
            startedAt: { gte: new Date(Date.now() - IDEMPOTENCY_WINDOW_MS) }
          },
          orderBy: { startedAt: 'desc' }
        });
        if (existing) {
          throw new HttpError(200, 'Idempotent retry response', {
            success: existing.status === 'SUCCESS',
            execution: existing,
            executionId: existing.id,
            retryCount: existing.retryCount,
            organizationId: session.orgId,
            idempotent: true
          });
        }
      }

      // Verify the workflow belongs to the org
      const dbWorkflow = await tx.flowWorkflow.findFirst({
        where: { id: workflowId, organizationId: session.orgId }
      });

      if (!dbWorkflow) {
        throw new HttpError(404, 'Workflow not found or access denied', {
          success: false,
          error: 'Workflow not found or access denied'
        });
      }

      if (dbWorkflow.status !== 'ACTIVE') {
        throw new HttpError(409, 'Only active workflows can be retried', {
          success: false,
          error: 'Only active workflows can be retried'
        });
      }

      const externalWorkflowId = dbWorkflow.externalWorkflowId;
      if (!externalWorkflowId) {
        throw new HttpError(400, 'Workflow has no external engine mapping; cannot retry', {
          success: false,
          error: 'Workflow has no external engine mapping; cannot retry'
        });
      }

      // Verify the execution exists, belongs to this workflow, and is FAILED
      const existingExecution = await tx.flowExecution.findFirst({
        where: { id: execId, workflowId: dbWorkflow.id }
      });

      if (!existingExecution) {
        throw new HttpError(404, 'Execution not found or does not belong to this workflow', {
          success: false,
          error: 'Execution not found or does not belong to this workflow'
        });
      }

      if (existingExecution.status !== 'FAILED') {
        throw new HttpError(
          409,
          `Cannot retry execution with status ${existingExecution.status}. Only FAILED executions can be retried.`,
          { success: false, error: `Cannot retry execution with status ${existingExecution.status}. Only FAILED executions can be retried.` }
        );
      }

      // Check retry limit
      if (existingExecution.retryCount >= MAX_RETRIES) {
        throw new HttpError(
          409,
          `Maximum retry limit (${MAX_RETRIES}) reached for this execution`,
          {
            success: false,
            error: `Maximum retry limit (${MAX_RETRIES}) reached for this execution`,
            retryCount: existingExecution.retryCount
          }
        );
      }

      // Mark the old execution as superseded
      await tx.flowExecution.update({
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
      const newExecutionRecord = await tx.flowExecution.create({
        data: {
          workflowId: dbWorkflow.id,
          status: 'RUNNING',
          retryCount: existingExecution.retryCount + 1,
          logsJson: idempotencyKey ? JSON.stringify({ idempotencyKey }) : undefined
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
        await tx.flowExecution.update({
          where: { id: newExecutionRecord.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            logsJson: JSON.stringify({
              error: error instanceof Error ? error.message : 'Engine request failed',
              retryCount: existingExecution.retryCount + 1,
              ...(idempotencyKey ? { idempotencyKey } : {})
            })
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
            retryCount: existingExecution.retryCount + 1,
            succeeded: false
          }
        });
        throw new HttpError(502, 'Workflow engine execution failed', {
          success: false,
          error: 'Workflow engine execution failed',
          executionId: newExecutionRecord.id,
          retryCount: existingExecution.retryCount + 1
        });
      }

      await tx.flowExecution.update({
        where: { id: newExecutionRecord.id },
        data: {
          status: execution.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          completedAt: new Date(),
          logsJson: JSON.stringify({
            ...(idempotencyKey ? { idempotencyKey } : {}),
            ...(execution.output ? { output: execution.output } : {})
          })
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
          retryCount: existingExecution.retryCount + 1,
          succeeded: execution.status === 'SUCCESS'
        }
      });

      return NextResponse.json({
        success: true,
        execution,
        executionId: newExecutionRecord.id,
        retryCount: existingExecution.retryCount + 1,
        organizationId: session.orgId
      });
    });
  } catch (error: any) {
    // HttpError thrown inside the transaction carries a pre-built NextResponse-compatible body
    if (error instanceof HttpError) {
      return NextResponse.json(error.body, { status: error.status });
    }
    if (error instanceof NextResponse) {
      throw error;
    }
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
