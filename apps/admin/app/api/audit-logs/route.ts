import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@circuitsoul/db';
import { requirePlatformAdmin } from '../../../lib/platform-admin';

const AuditLogsQuerySchema = z.object({
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
  organizationId: z.string().optional(),
  action: z.string().optional()
});

export async function GET(request: Request) {
  try {
    await requirePlatformAdmin(Object.fromEntries(request.headers.entries()));

    const { searchParams } = new URL(request.url);
    const parsed = AuditLogsQuerySchema.safeParse({
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
      organizationId: searchParams.get('organizationId') || undefined,
      action: searchParams.get('action') || undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid query' },
        { status: 400 }
      );
    }

    const { limit, offset, organizationId, action } = parsed.data;

    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit, 10),
        skip: parseInt(offset, 10)
      }),
      prisma.activityLog.count({ where })
    ]);

    return NextResponse.json({
      success: true,
      logs,
      total,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('Forbidden')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
