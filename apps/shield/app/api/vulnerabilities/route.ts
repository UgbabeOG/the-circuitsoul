import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { shieldAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const NdpRConfigSchema = z.object({
  dbHostingRegion: z.string().min(2),
  encryptionAtRestEnabled: z.boolean().default(true),
  encryptionInTransitEnabled: z.boolean().default(true),
  consentLoggingActive: z.boolean().default(true),
  dataRetentionDays: z.number().int().min(1).max(3650).default(365),
  privacyPolicyPublished: z.boolean().default(true),
  dpoDesignated: z.boolean().default(false),
  breachNotificationProcessReady: z.boolean().default(false),
  thirdPartyDataContractsSigned: z.boolean().default(false)
});

const ScanRequestSchema = z.object({
  assetId: z.string().uuid()
});

async function authorizeAssetAccess(
  organizationId: string,
  assetId: string
) {
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, organizationId, isAuthorized: true }
  });

  if (!asset) {
    throw new Error('Asset not found or not authorized for scanning by this organization.');
  }

  return asset;
}

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId');

    if (!assetId) {
      return NextResponse.json(
        { success: false, error: 'assetId is required' },
        { status: 400 }
      );
    }

    // Require asset authorization before exposing vulnerability data
    const asset = await authorizeAssetAccess(session.orgId, assetId);

    // Resolve agent ID from trusted org-owned asset mapping, never from caller input
    const agentId = asset.agentId || asset.target;

    const data = await shieldAdapter.getVulnerabilities(agentId);

    return NextResponse.json({
      success: true,
      data,
      organizationId: session.orgId,
      assetId: asset.id
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch vulnerabilities' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const body = await request.json();

    const parsed = ScanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid scan request' },
        { status: 400 }
      );
    }

    // Require explicit asset authorization before triggering any scan
    const asset = await authorizeAssetAccess(session.orgId, parsed.data.assetId);

    // Resolve agent ID from trusted org-owned asset mapping
    const agentId = asset.agentId || asset.target;

    const result = await shieldAdapter.triggerScan(agentId);

    // Record the scan in the assessment history
    await prisma.shieldAssessment.create({
      data: {
        organizationId: session.orgId,
        assetId: asset.id,
        status: 'PENDING',
        score: 0,
        overallRisk: 'UNKNOWN',
        isVerifiedTechnical: false
      }
    });

    return NextResponse.json({
      success: true,
      data: result,
      organizationId: session.orgId,
      assetId: asset.id
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Scan trigger failed' },
      { status: 500 }
    );
  }
}
