import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { opsAdapter } from '@circuitsoul/api-adapters';

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const { searchParams } = new URL(request.url);
    const hostId = searchParams.get('hostId') || 'lagos-core-node-01';

    const data = await opsAdapter.getResourceMetrics(hostId);

    return NextResponse.json({
      success: true,
      data,
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
