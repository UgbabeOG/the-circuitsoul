import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { aiService } from '@circuitsoul/ai';
import { enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { z } from 'zod';

const OptimizationSchema = z.object({
  provider: z.string().default('AWS'),
  resourceDetails: z.string().min(1)
});

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

    const advice = await aiService.recommendCloudOptimization(
      parsed.data.provider,
      parsed.data.resourceDetails
    );

    await recordUsage({
      organizationId: session.orgId,
      eventType: 'CLOUD_OPTIMIZATION',
      generationMs: 1450,
      rawPayload: {
        provider: parsed.data.provider,
        resourceDetails: parsed.data.resourceDetails
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
