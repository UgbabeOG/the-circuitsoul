import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { Permission, requireAuthenticatedPermission } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.VIEW_ORG
    );

    const dbWorkflows = await prisma.flowWorkflow.findMany({
      where: { organizationId: session.orgId },
      include: { executions: { take: 5, orderBy: { startedAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      workflows: dbWorkflows,
      count: dbWorkflows.length,
      organizationId: session.orgId
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
      { success: false, error: error.message || 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuthenticatedPermission(
      Object.fromEntries(request.headers.entries()),
      Permission.MANAGE_WORKFLOWS
    );
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Workflow name is required' },
        { status: 400 }
      );
    }

    const newWorkflow = await flowAdapter.createWorkflow({
      name: body.name,
      description: body.description,
      templateId: body.templateId,
      nodes: body.nodes,
      triggerType: body.triggerType
    });

    const externalWorkflowId = newWorkflow?.id || null;

    const dbRecord = await prisma.flowWorkflow.create({
      data: {
        organizationId: session.orgId,
        name: body.name,
        description: body.description || null,
        status: 'ACTIVE',
        triggerType: body.triggerType || 'Manual',
        definitionJson: JSON.stringify(body.nodes || []),
        externalWorkflowId
      }
    });

    return NextResponse.json({
      success: true,
      workflow: dbRecord,
      organizationId: session.orgId
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
      { success: false, error: error.message || 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
