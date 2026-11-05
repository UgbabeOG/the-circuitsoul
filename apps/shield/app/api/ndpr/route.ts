import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { evaluateNDPRCompliance } from '@circuitsoul/security';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const NdpRConfigSchema = z.object({
  dbHostingRegion: z.string().min(2),
  isDataInAdequacyZone: z.boolean(),
  encryptionAtRestEnabled: z.boolean(),
  encryptionInTransitEnabled: z.boolean(),
  consentLoggingActive: z.boolean(),
  dataRetentionDays: z.number().int().min(1).max(3650),
  privacyPolicyPublished: z.boolean(),
  dpoDesignated: z.boolean(),
  breachNotificationProcessReady: z.boolean(),
  thirdPartyDataContractsSigned: z.boolean()
}).strict();

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(Object.fromEntries(request.headers.entries()));
    const assessments = await prisma.nDPRAssessment.findMany({
      where: { organizationId: session.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        score: true,
        compliant: true,
        answersJson: true,
        remediationsJson: true,
        conductedBy: true,
        createdAt: true
      }
    });
    return NextResponse.json({ success: true, assessments });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to load assessment history' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(Object.fromEntries(request.headers.entries()));
    const input = NdpRConfigSchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json(
        { success: false, error: input.error.issues[0]?.message || 'Invalid NDPR assessment' },
        { status: 400 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { name: true }
    });
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 403 });
    }

    const report = evaluateNDPRCompliance({
      organizationName: organization.name,
      ...input.data
    });
    const assessment = await prisma.nDPRAssessment.create({
      data: {
        organizationId: session.orgId,
        score: report.overallScore,
        compliant: report.compliant,
        answersJson: JSON.stringify(input.data),
        remediationsJson: JSON.stringify(report.requiredRemediations),
        conductedBy: session.userId
      },
      select: { id: true, score: true, compliant: true, createdAt: true }
    });

    return NextResponse.json({
      success: true,
      assessment: { ...assessment, ...report, assessmentType: 'SELF_REPORTED' },
      organizationId: session.orgId
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'NDPR assessment failed' }, { status: 500 });
  }
}
