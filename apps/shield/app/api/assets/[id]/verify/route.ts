import { NextResponse } from 'next/server';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { shieldAdapter } from '@circuitsoul/api-adapters';
import { z } from 'zod';

const VerifySchema = z.object({ agentId: z.string().min(1).max(128) }).strict();

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_ASSETS
    );
    if (!z.string().uuid().safeParse(params.id).success) {
      return NextResponse.json({ success: false, error: 'A valid asset UUID is required' }, { status: 400 });
    }
    const input = VerifySchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json({ success: false, error: input.error.issues[0]?.message || 'Invalid agent mapping' }, { status: 400 });
    }

    const asset = await prisma.asset.findFirst({
      where: { id: params.id, organizationId: session.orgId, isAuthorized: true }
    });
    if (!asset) {
      return NextResponse.json({ success: false, error: 'Authorized asset not found' }, { status: 404 });
    }

    const verified = await shieldAdapter.verifyAssetAgent(input.data.agentId, asset.target);
    if (!verified) {
      return NextResponse.json({
        success: false,
        state: process.env.USE_MOCK_ENGINES === 'true' ? 'demo' : 'unverified',
        error: 'The Wazuh agent could not be verified against this asset target'
      }, { status: 409 });
    }

    const updated = await prisma.asset.update({
      where: { id: asset.id },
      data: { agentId: input.data.agentId, verified: true }
    });
    return NextResponse.json({ success: true, asset: updated });
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
    return NextResponse.json({ success: false, state: 'unavailable', error: 'Asset verification service is unavailable' }, { status: 503 });
  }
}
