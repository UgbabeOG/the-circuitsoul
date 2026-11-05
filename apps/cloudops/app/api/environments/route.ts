import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { encryptCloudCredentials } from '@circuitsoul/security';
import { z } from 'zod';

const ConnectEnvironmentSchema = z.object({
  provider: z.enum(['AWS', 'GCP', 'AZURE']),
  name: z.string().min(1),
  credentials: z.string().min(1)
}).strict();

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

    const { provider, name, credentials } = parsed.data;

    // Encrypt credentials on write - never store plaintext
    const { credentialsEncrypted, credentialsIv } = encryptCloudCredentials(
      credentials
    );

    const environment = (await prisma.cloudEnvironment.create({
      data: {
        organizationId: session.orgId,
        provider,
        name,
        credentialsEncrypted,
        credentialsIv,
        status: 'DISCONNECTED'
      },
      select: {
        id: true,
        provider: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    }));

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
        createdAt: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    }));

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
