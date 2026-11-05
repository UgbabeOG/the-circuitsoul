import { NextResponse } from 'next/server';
import { Permission, requireAuthenticatedOrg, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { shieldAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const AssetIdSchema = z.string().uuid();
const ScanRequestSchema = z.object({ assetId: AssetIdSchema }).strict();
const SeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const FindingSchema = z.object({
  id: z.string().optional(),
  cve: z.string().optional(),
  title: z.string().optional(),
  name: z.string().optional(),
  severity: z.string(),
  description: z.string().optional(),
  remediation: z.string().optional()
});

type Finding = {
  title: string;
  severity: z.infer<typeof SeveritySchema>;
  description: string;
  remediation: string;
};

async function findAuthorizedAsset(organizationId: string, assetId: string) {
  return prisma.asset.findFirst({
    where: { id: assetId, organizationId, isAuthorized: true }
  });
}

function normalizeFindings(raw: unknown): Finding[] | null {
  let items: unknown;
  if (Array.isArray(raw)) {
    items = raw;
  } else if (raw && typeof raw === 'object') {
    const response = raw as { data?: { affected_items?: unknown }; affected_items?: unknown };
    items = response.data?.affected_items ?? response.affected_items;
  }
  if (!Array.isArray(items)) return null;

  const findings: Finding[] = [];
  for (const item of items) {
    const parsed = FindingSchema.safeParse(item);
    if (!parsed.success) return null;
    const severity = SeveritySchema.safeParse(parsed.data.severity.toUpperCase());
    const title = parsed.data.title || parsed.data.name || parsed.data.cve || parsed.data.id;
    if (!severity.success || !title) return null;
    findings.push({
      title,
      severity: severity.data,
      description: parsed.data.description || 'The scanner did not return a description for this finding.',
      remediation: parsed.data.remediation || 'The scanner did not return a remediation for this finding.'
    });
  }
  return findings;
}

function scoreFindings(findings: Finding[]) {
  const weights = { CRITICAL: 30, HIGH: 18, MEDIUM: 8, LOW: 3 } as const;
  const score = Math.max(0, 100 - findings.reduce((total, finding) => total + weights[finding.severity], 0));
  const overallRisk = score >= 85 ? 'LOW' : score >= 60 ? 'MEDIUM' : 'HIGH';
  return { score, overallRisk };
}

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(Object.fromEntries(request.headers.entries()));
    const assetId = new URL(request.url).searchParams.get('assetId') || '';
    if (!AssetIdSchema.safeParse(assetId).success) {
      return NextResponse.json({ success: false, error: 'A valid asset UUID is required' }, { status: 400 });
    }

    const asset = await findAuthorizedAsset(session.orgId, assetId);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found or not authorized' }, { status: 404 });
    }
    if (!asset.verified || !asset.agentId) {
      return NextResponse.json(
        { success: false, state: 'unavailable', error: 'No verified Wazuh agent is mapped to this asset' },
        { status: 409 }
      );
    }

    const pending = await prisma.shieldAssessment.findFirst({
      where: { organizationId: session.orgId, assetId: asset.id, status: 'PENDING' },
      orderBy: { createdAt: 'desc' }
    });
    if (pending) {
      const rawFindings = await shieldAdapter.getVulnerabilities(asset.agentId);
      const findings = normalizeFindings(rawFindings);
      if (!findings) {
        return NextResponse.json(
          { success: false, state: 'unavailable', error: 'Scanner returned an unsupported findings response' },
          { status: 502 }
        );
      }

      const { score, overallRisk } = scoreFindings(findings);
      const source = process.env.USE_MOCK_ENGINES === 'true' ? 'demo' : 'live';
      const assessment = await prisma.$transaction(async (transaction) => {
        if (findings.length) {
          await transaction.shieldVulnerability.createMany({
            data: findings.map((finding) => ({ assessmentId: pending.id, ...finding }))
          });
        }
        return transaction.shieldAssessment.update({
          where: { id: pending.id },
          data: {
            status: 'COMPLETED',
            score,
            overallRisk,
            isVerifiedTechnical: source === 'live'
          },
          include: { vulnerabilities: true }
        });
      });
      return NextResponse.json({ success: true, assessment, data: assessment.vulnerabilities, source });
    }

    const assessment = await prisma.shieldAssessment.findFirst({
      where: { organizationId: session.orgId, assetId: asset.id, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      include: { vulnerabilities: true }
    });
    return NextResponse.json({
      success: true,
      assessment,
      data: assessment?.vulnerabilities || [],
      source: assessment?.isVerifiedTechnical ? 'live' : 'demo'
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Failed to fetch vulnerability assessment' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_ASSETS
    );
    const parsed = ScanRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid scan request' },
        { status: 400 }
      );
    }
    const asset = await findAuthorizedAsset(session.orgId, parsed.data.assetId);
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Asset not found or not authorized' }, { status: 404 });
    }
    if (!asset.verified || !asset.agentId) {
      return NextResponse.json(
        { success: false, state: 'unavailable', error: 'No verified Wazuh agent is mapped to this asset' },
        { status: 409 }
      );
    }

    const assessment = await prisma.shieldAssessment.create({
      data: {
        organizationId: session.orgId,
        assetId: asset.id,
        createdById: session.userId,
        status: 'PENDING',
        score: 0,
        overallRisk: 'UNKNOWN',
        isVerifiedTechnical: false
      },
      select: { id: true, status: true, createdAt: true }
    });
    try {
      const result = await shieldAdapter.triggerScan(asset.agentId);
      await prisma.asset.update({
        where: { id: asset.id },
        data: { lastScannedAt: new Date() }
      });
      return NextResponse.json({
        success: true,
        data: result,
        assessment,
        source: process.env.USE_MOCK_ENGINES === 'true' ? 'demo' : 'live',
        organizationId: session.orgId,
        assetId: asset.id
      }, { status: 202 });
    } catch (error) {
      await prisma.shieldAssessment.update({
        where: { id: assessment.id },
        data: { status: 'FAILED' }
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, state: 'unavailable', error: 'Scan could not be completed' }, { status: 503 });
  }
}
