import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
    const trends = blogAdapter.getTrends();
    return NextResponse.json({
      success: true,
      trends
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
