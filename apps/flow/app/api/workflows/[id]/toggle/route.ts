import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { z } from 'zod';

const ToggleSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) }).strict();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_WORKFLOWS
    );
    const workflowId = params.id;
    const body = ToggleSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { success: false, error: body.error.issues[0]?.message || 'Invalid workflow status' },
        { status: 400 }
      );
    }
    const newStatus = body.data.status;

    const existingWorkflow = await prisma.flowWorkflow.findFirst({
      where: { id: workflowId, organizationId: session.orgId }
    });

    if (!existingWorkflow) {
      return NextResponse.json(
        { success: false, error: 'Workflow not found or access denied' },
        { status: 404 }
      );
    }

    if (!existingWorkflow.externalWorkflowId) {
      return NextResponse.json(
        { success: false, error: 'Workflow has no external engine mapping; cannot toggle status' },
        { status: 400 }
      );
    }

    const result = await flowAdapter.toggleWorkflowStatus(
      existingWorkflow.externalWorkflowId,
      newStatus
    );

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
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle workflow status' },
      { status: 500 }
    );
  }
}
