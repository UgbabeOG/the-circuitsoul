import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma, Prisma } from '@circuitsoul/db';
import { encryptCloudCredentials } from '@circuitsoul/security';
import { z } from 'zod';

const ConnectEnvironmentSchema = z.object({
  provider: z.enum(['AWS', 'GCP', 'AZURE']),
  name: z.string().min(1),
  credentialsJson: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );
    const body = await request.json();

    const parsed = ConnectEnvironmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { provider, name, credentialsJson } = parsed.data;

    // Encrypt credentials on write - never store plaintext
    const { credentialsEncrypted, credentialsIv } = encryptCloudCredentials(
      credentialsJson
    );

    const environment = (await prisma.cloudEnvironment.create({
      data: {
        organizationId: session.orgId,
        provider,
        name,
        credentialsJson: '', // Plaintext write path removed - intentionally empty
        credentialsEncrypted,
        credentialsIv,
        status: 'CONNECTED',
        score: 0,
        costMonthly: new Prisma.Decimal(0)
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        score: true,
        costMonthly: true,
        createdAt: true,
        updatedAt: true
      }
    })) as unknown as { id: string; provider: string; name: string; status: string; score: number; costMonthly: number; createdAt: Date; updatedAt: Date };

    return NextResponse.json({
      success: true,
      environment,
      organizationId: session.orgId,
      message: 'Cloud environment connected. Credentials are stored encrypted at rest.'
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to connect cloud environment' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    const environments = (await prisma.cloudEnvironment.findMany({
      where: { organizationId: session.orgId },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        score: true,
        costMonthly: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    })) as Array<{ id: string; provider: string; name: string; status: string; score: number; costMonthly: unknown; createdAt: Date; updatedAt: Date }>;

    return NextResponse.json({
      success: true,
      environments,
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
      { success: false, error: error.message || 'Failed to fetch environments' },
      { status: 500 }
    );
  }
}
