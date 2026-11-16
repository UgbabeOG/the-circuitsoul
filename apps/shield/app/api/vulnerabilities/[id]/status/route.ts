import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const VulnerabilityStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE'])
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const id = (await params).id;
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { success: false, error: 'A valid vulnerability UUID is required' },
        { status: 400 }
      );
    }

    const parsed = VulnerabilityStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid status' },
        { status: 400 }
      );
    }

    const vulnerability = await prisma.shieldVulnerability.findFirst({
      where: {
        id,
        assessment: { organizationId: session.orgId }
      },
      select: { id: true, title: true, status: true, assessmentId: true }
    });

    if (!vulnerability) {
      return NextResponse.json(
        { success: false, error: 'Finding not found for this organization' },
        { status: 404 }
      );
    }

    const updated = await prisma.shieldVulnerability.update({
      where: { id },
      data: { status: parsed.data.status },
      select: { id: true, title: true, severity: true, status: true, updatedAt: true }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: session.orgId,
        userId: session.userId,
        action: 'SHIELD_VULNERABILITY_STATUS_CHANGED',
        metadataJson: JSON.stringify({
          vulnerabilityId: vulnerability.id,
          previousStatus: vulnerability.status,
          newStatus: parsed.data.status,
          assessmentId: vulnerability.assessmentId
        })
      }
    });

    return NextResponse.json({
      success: true,
      data: updated,
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
      { success: false, error: error.message || 'Failed to update vulnerability status' },
      { status: 500 }
    );
  }
}
