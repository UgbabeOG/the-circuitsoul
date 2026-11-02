import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId') || undefined;

    const executions = await flowAdapter.getExecutions(workflowId);

    return NextResponse.json({
      success: true,
      executions
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch executions' },
      { status: 500 }
    );
  }
}
