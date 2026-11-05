import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { z } from 'zod';

const AuditLogsQuerySchema = z.object({
  limit: z.string().optional().default('50'),
  offset: z.string().optional().default('0'),
  organizationId: z.string().optional(),
  action: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const { session } = await requireAuthenticatedOrg(
      Object.fromEntries(request.headers.entries())
    );

    // Only owners and admins can view audit logs
    if (session.role !== 'OWNER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Requires OWNER or ADMIN role' },
        { status: 403 }
      );
    }

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
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
