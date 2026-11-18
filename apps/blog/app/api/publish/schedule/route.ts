import { NextResponse } from 'next/server';
import { requireAuthenticatedPermission } from '@circuitsoul/auth';
import { Permission } from '@circuitsoul/auth';
import { publishScheduledArticles } from '@circuitsoul/events';

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_BLOG
    );

    const results = await publishScheduledArticles();

    return NextResponse.json({
      success: true,
      published: results.filter((r: { status: string }) => r.status === 'PUBLISHED').length,
      failed: results.filter((r: { status: string }) => r.status === 'FAILED').length,
      results
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Scheduled publishing failed' },
      { status: 500 }
    );
  }
}
