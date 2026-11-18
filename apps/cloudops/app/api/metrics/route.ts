import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { opsAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const { searchParams } = new URL(request.url);
    const hostId = searchParams.get('hostId');

    if (!hostId || !z.string().uuid().safeParse(hostId).success) {
      return NextResponse.json(
        { success: false, error: 'A valid cloud environment UUID is required' },
        { status: 400 }
      );
    }

    // Bind host/environment ID to an org-owned CloudEnvironment record.
    // The Prometheus instance label is stored separately and is NOT assumed
    // to equal the environment UUID.
    const environment = await prisma.cloudEnvironment.findFirst({
      where: { id: hostId, organizationId: session.orgId },
      select: {
        id: true,
        prometheusInstanceLabel: true
      }
    });

    if (!environment) {
      return NextResponse.json(
        { success: false, error: 'Cloud environment not found or not authorized for this organization' },
        { status: 404 }
      );
    }

    let data: Awaited<ReturnType<typeof opsAdapter.getResourceMetrics>>;
    try {
      // Use the stored Prometheus instance label, falling back to the env UUID
      // only when no label has been configured (backward compatibility).
      data = await opsAdapter.getResourceMetrics(
        environment.prometheusInstanceLabel ?? hostId
      );
    } catch {
      return NextResponse.json({
        success: true,
        data: { state: 'unavailable', cpu: null, memory: null, timestamp: null },
        organizationId: session.orgId,
        environmentId: environment.id
      });
    }

    // Persist the metric sample for historical reporting.
    if (data.state !== 'unavailable') {
      await prisma.cloudMetric.create({
        data: {
          environmentId: environment.id,
          cpuUtilization: data.cpu ?? 0,
          memoryUtilization: data.memory ?? 0,
          costDaily: null
        }
      });
    }

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
