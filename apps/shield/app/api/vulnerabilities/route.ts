import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { shieldAdapter } from '@circuitsoul/api-adapters';
import { evaluateNDPRCompliance } from '@circuitsoul/security';
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

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId') || 'agent-001';

    const data = await shieldAdapter.getVulnerabilities(agentId);

    return NextResponse.json({
      success: true,
      data,
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
    const { agentId = 'agent-001' } = body;

    const result = await shieldAdapter.triggerScan(agentId);

    return NextResponse.json({
      success: true,
      data: result,
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
      { success: false, error: error.message || 'Scan trigger failed' },
      { status: 500 }
    );
  }
}
