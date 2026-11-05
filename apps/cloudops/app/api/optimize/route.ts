import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { aiService } from '@circuitsoul/ai';
import { enforceEntitlement, prisma, recordUsage } from '@circuitsoul/db';
import { opsAdapter } from '@circuitsoul/api-adapters';
import { z } from 'zod';

const OptimizationSchema = z.object({
  environmentId: z.string().uuid()
}).strict();

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    // Enforce entitlement before cloud optimization
    await enforceEntitlement(session.orgId, 'CLOUD_OPTIMIZATION');

    const body = await request.json();

    const parsed = OptimizationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid optimization request' },
        { status: 400 }
      );
    }

    const environment = await prisma.cloudEnvironment.findFirst({
      where: { id: parsed.data.environmentId, organizationId: session.orgId },
      select: { id: true, provider: true }
    });
    if (!environment) {
      return NextResponse.json({ success: false, error: 'Cloud environment not found' }, { status: 404 });
    }

    const metrics = await opsAdapter.getResourceMetrics(environment.id);
    if (metrics.state !== 'live' || metrics.cpu === null || metrics.memory === null) {
      return NextResponse.json(
        { success: false, state: metrics.state, error: 'Optimization requires complete live Prometheus metrics' },
        { status: 409 }
      );
    }

    const resourceDetails = JSON.stringify({
      environmentId: environment.id,
      cpuUtilizationPercent: metrics.cpu,
      memoryUtilizationPercent: metrics.memory,
      observedAt: metrics.timestamp
    });
    const startedAt = Date.now();
    const advice = await aiService.recommendCloudOptimization(environment.provider, resourceDetails);

    await recordUsage({
      organizationId: session.orgId,
      eventType: 'CLOUD_OPTIMIZATION',
      generationMs: Date.now() - startedAt,
      rawPayload: {
        environmentId: environment.id,
        provider: environment.provider,
        resourceDetails
      }
    });

    return NextResponse.json({
      success: true,
      data: { optimization: advice },
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('EntitlementDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Optimization generation failed' },
      { status: 500 }
    );
  }
}
