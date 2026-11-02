import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { Role, assertOrganizationMembership } from '@circuitsoul/db';
import { requireMembership, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requireMembership(requireSession(Object.fromEntries(request.headers.entries())));
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId') || undefined;

    const executions = await flowAdapter.getExecutions(workflowId);

    return NextResponse.json({
      success: true,
      executions
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
