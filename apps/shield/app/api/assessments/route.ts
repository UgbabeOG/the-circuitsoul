import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const AssessmentQuerySchema = z.object({
  assetId: z.string().uuid().optional()
}).strict();

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const { searchParams } = new URL(request.url);
    const parsed = AssessmentQuerySchema.safeParse({ assetId: searchParams.get('assetId') });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const where: { organizationId: string; assetId?: string } = {
      organizationId: session.orgId
    };
    if (parsed.data.assetId) {
      where.assetId = parsed.data.assetId;
    }

    const assessments = await prisma.shieldAssessment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        asset: {
          select: { id: true, name: true, target: true, type: true, verified: true }
        },
        vulnerabilities: {
          select: {
            id: true,
            title: true,
            severity: true,
            description: true,
            remediation: true,
            status: true,
            createdAt: true,
            updatedAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        createdBy: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: assessments,
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
      { success: false, error: error.message || 'Failed to load assessment history' },
      { status: 500 }
    );
  }
}
