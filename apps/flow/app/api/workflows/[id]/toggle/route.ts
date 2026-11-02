import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const workflowId = params.id;
    const body = await request.json();
    const newStatus: 'ACTIVE' | 'INACTIVE' = body.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';

    const result = await flowAdapter.toggleWorkflowStatus(workflowId, newStatus);

    try {
      await prisma.flowWorkflow.updateMany({
        where: { id: workflowId },
        data: { status: newStatus }
      });
    } catch {
      // Dev/mock mode
    }

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to toggle workflow status' },
      { status: 500 }
    );
  }
}
