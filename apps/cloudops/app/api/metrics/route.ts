import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { opsAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const { searchParams } = new URL(request.url);
    const hostId = searchParams.get('hostId');

    if (!hostId) {
      return NextResponse.json(
        { success: false, error: 'hostId is required' },
        { status: 400 }
      );
    }

    // Bind host/environment ID to an org-owned CloudEnvironment record
    const environment = await prisma.cloudEnvironment.findFirst({
      where: { id: hostId, organizationId: session.orgId }
    });

    if (!environment) {
      return NextResponse.json(
        { success: false, error: 'Cloud environment not found or not authorized for this organization' },
        { status: 404 }
      );
    }

    const data = await opsAdapter.getResourceMetrics(environment.id);

    return NextResponse.json({
      success: true,
      data,
      organizationId: session.orgId,
      environmentId: environment.id
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
