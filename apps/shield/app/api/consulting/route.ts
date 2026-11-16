import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const ConsultingRequestSchema = z.object({
  contactName: z.string().min(2),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  scope: z.enum([
    'PENETRATION_TESTING',
    'NDPR_AUDIT_ASSISTANCE',
    'CLOUD_HARDENING',
    'INCIDENT_RESPONSE'
  ]),
  notes: z.string().optional()
}).strict();

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const parsed = ConsultingRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid consulting request' },
        { status: 400 }
      );
    }

    const requestRecord = await prisma.securityConsultingRequest.create({
      data: {
        organizationId: session.orgId,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone ?? null,
        scope: parsed.data.scope,
        notes: parsed.data.notes ?? null,
        status: 'PENDING'
      },
      select: {
        id: true,
        contactName: true,
        contactEmail: true,
        scope: true,
        status: true,
        createdAt: true
      }
    });

    await prisma.activityLog.create({
      data: {
        organizationId: session.orgId,
        userId: session.userId,
        action: 'SECURITY_CONSULTING_REQUESTED',
        metadataJson: JSON.stringify({
          consultingRequestId: requestRecord.id,
          scope: requestRecord.scope,
          contactEmail: requestRecord.contactEmail
        })
      }
    });

    return NextResponse.json({
      success: true,
      data: requestRecord,
      organizationId: session.orgId
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Consulting request failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const requests = await prisma.securityConsultingRequest.findMany({
      where: { organizationId: session.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        contactName: true,
        contactEmail: true,
        scope: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return NextResponse.json({
      success: true,
      data: requests,
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
      { success: false, error: error.message || 'Failed to load consulting requests' },
      { status: 500 }
    );
  }
}
