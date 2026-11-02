import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { aiService } from '@circuitsoul/ai';
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
    return NextResponse.json(
      { success: false, error: error.message || 'Optimization generation failed' },
      { status: 500 }
    );
  }
}
