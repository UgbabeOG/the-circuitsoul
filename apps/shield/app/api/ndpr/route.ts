import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
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

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const body = await request.json();

    const parsed = NdpRConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid NDPR config' },
        { status: 400 }
      );
    }

    const report = evaluateNDPRCompliance({
      organizationName: session.orgId,
      ...parsed.data
    });

    return NextResponse.json({
      success: true,
      data: report,
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
      { success: false, error: error.message || 'NDPR audit failed' },
      { status: 500 }
    );
  }
}
