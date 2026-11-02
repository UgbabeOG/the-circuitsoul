import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { parseSession } from '@circuitsoul/auth';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    const workflowId = params.id;
    const body = await request.json().catch(() => ({}));
    const payload = body.payload || {};
    const triggerSource = body.triggerSource || 'CIRCUITSOUL_FLOW_UI';

    // 1. Trigger the workflow through the decoupled n8n adapter
    const execution = await flowAdapter.triggerWorkflow(
      workflowId,
      payload,
      triggerSource
    );

    // 2. Track customer billing & usage
    try {
      if (session?.orgId) {
        await prisma.usageEvent.create({
          data: {
            organizationId: session.orgId,
            eventType: 'WORKFLOW_EXECUTION',
            jobsExecuted: 1,
            generationMs: execution.durationMs || 500,
            rawPayload: {
              workflowId,
              executionId: execution.id,
              triggerSource
            }
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    // 3. Attempt to record execution in Prisma FlowExecution
    try {
      const dbWorkflow = await prisma.flowWorkflow.findFirst({
        where: { id: workflowId }
      });

      if (dbWorkflow) {
        await prisma.flowExecution.create({
          data: {
            workflowId: dbWorkflow.id,
            status: execution.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
            completedAt: new Date(),
            logsJson: JSON.stringify(execution.output)
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    return NextResponse.json({
      success: true,
      execution
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Execution failed' },
      { status: 500 }
    );
  }
}
