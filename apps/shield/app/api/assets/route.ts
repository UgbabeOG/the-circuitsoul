import { NextResponse } from 'next/server';
import { prisma } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { AssetSchema } from '@circuitsoul/shared-types';

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_ASSETS
    );
    const orgId = session.orgId;

    const assets = await prisma.asset.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      assets,
      count: assets.length
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch digital assets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_ASSETS
    );
    const orgId = session.orgId;
    const body = await request.json();

    const parsed = AssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid asset data' },
        { status: 400 }
      );
    }

    const asset = await prisma.asset.create({
      data: {
        organizationId: orgId,
        name: parsed.data.name,
        type: parsed.data.type as any,
        target: parsed.data.target,
        isAuthorized: parsed.data.isAuthorized,
        verified: true
      }
    });

    return NextResponse.json({
      success: true,
      asset
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to register asset' },
      { status: 500 }
    );
  }
}
