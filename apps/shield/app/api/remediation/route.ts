import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { aiService } from '@circuitsoul/ai';
import { enforceEntitlement, recordUsage } from '@circuitsoul/db';
import { z } from 'zod';

const RemediationSchema = z.object({
  vulnerabilityTitle: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM')
});

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    // Enforce entitlement before AI remediation
    await enforceEntitlement(session.orgId, 'AI_GENERATION');

    const body = await request.json();

    const parsed = RemediationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid remediation request' },
        { status: 400 }
      );
    }

    const advice = await aiService.recommendRemediation(
      parsed.data.vulnerabilityTitle,
      parsed.data.severity
    );

    await recordUsage({
      organizationId: session.orgId,
      eventType: 'SHIELD_REMEDIATION',
      generationMs: 1450,
      rawPayload: {
        vulnerabilityTitle: parsed.data.vulnerabilityTitle,
        severity: parsed.data.severity
      }
    });

    return NextResponse.json({
      success: true,
      data: { remediation: advice },
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
      { success: false, error: error.message || 'Remediation generation failed' },
      { status: 500 }
    );
  }
}
