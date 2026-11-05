import { NextResponse } from 'next/server';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.VIEW_ORG
    );
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
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}
