import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { aiService } from '@circuitsoul/ai';
import { enforceEntitlement, prisma, recordUsage } from '@circuitsoul/db';
import { z } from 'zod';

const RemediationSchema = z.object({
  vulnerabilityId: z.string().uuid()
}).strict();

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

    const vulnerability = await prisma.shieldVulnerability.findFirst({
      where: {
        id: parsed.data.vulnerabilityId,
        assessment: { organizationId: session.orgId }
      },
      select: { id: true, title: true, severity: true, description: true }
    });
    if (!vulnerability) {
      return NextResponse.json({ success: false, error: 'Finding not found for this organization' }, { status: 404 });
    }

    const prompt = [
      `Finding: ${vulnerability.title}`,
      `Severity: ${vulnerability.severity}`,
      `Scanner evidence: ${vulnerability.description}`
    ].join('\n');
    const startedAt = Date.now();
    const advice = await aiService.recommendRemediation(vulnerability.title, vulnerability.severity);

    await recordUsage({
      organizationId: session.orgId,
      eventType: 'SHIELD_REMEDIATION',
      userId: session.userId,
      generationMs: Date.now() - startedAt,
      rawPayload: { vulnerabilityId: vulnerability.id, prompt, recommendation: advice }
    });
    await prisma.activityLog.create({
      data: {
        organizationId: session.orgId,
        userId: session.userId,
        action: 'SHIELD_REMEDIATION_GENERATED',
        metadataJson: JSON.stringify({ vulnerabilityId: vulnerability.id, prompt, recommendation: advice })
      }
    });

    return NextResponse.json({
      success: true,
      data: { vulnerabilityId: vulnerability.id, remediation: advice },
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
