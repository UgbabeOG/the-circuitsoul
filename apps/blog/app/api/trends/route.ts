import { NextResponse } from 'next/server';
import { prisma } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';
import { enqueueTrendCollection } from '@circuitsoul/events';

export async function GET(request: Request) {
  try {
    await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.VIEW_ORG
    );

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const cursor = searchParams.get('cursor') || undefined;

    const trends = await prisma.collectedTrend.findMany({
      orderBy: { combinedScore: 'desc', collectedAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        source: {
          select: { id: true, name: true, provider: true }
        }
      }
    });

    const nextCursor = trends.length > limit ? trends[limit - 1].id : null;
    const page = trends.slice(0, limit);

    return NextResponse.json({
      success: true,
      trends: page.map((t) => ({
        id: t.id,
        topic: t.topic,
        summary: t.summary,
        category: t.category,
        region: t.region,
        relevanceScore: t.relevanceScore,
        freshnessScore: t.freshnessScore,
        audienceValueScore: t.audienceValueScore,
        combinedScore: t.combinedScore,
        externalUrl: t.externalUrl,
        collectedAt: t.collectedAt,
        source: t.source
      })),
      nextCursor,
      hasMore: trends.length > limit
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch trends' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.VIEW_ORG
    );

    const { searchParams } = new URL(request.url);
    const region = searchParams.get('region') || undefined;

    // Enqueue daily trend collection via BullMQ
    await enqueueTrendCollection(
      {
        organizationId: session.orgId,
        regionHint: region
      },
      undefined,
      { jobId: `trend-collect-${session.orgId}-${Date.now()}` }
    );

    return NextResponse.json({
      success: true,
      message: 'Trend collection enqueued',
      organizationId: session.orgId
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Trend collection failed' },
      { status: 500 }
    );
  }
}
