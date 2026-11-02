import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma, Role, assertOrganizationMembership } from '@circuitsoul/db';
import { Permission, requirePermission, requireSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.VIEW_ORG);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
    const workflows = await flowAdapter.getWorkflows();
    const templates = flowAdapter.getTemplates();

    const dbWorkflows = await prisma.flowWorkflow.findMany({
      where: { organizationId: session.orgId },
      include: { executions: { take: 5, orderBy: { startedAt: 'desc' } } }
    });

    return NextResponse.json({
      success: true,
      workflows,
      dbWorkflows,
      templates,
      count: workflows.length
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = requirePermission(requireSession(Object.fromEntries(request.headers.entries())), Permission.MANAGE_WORKFLOWS);
    await assertOrganizationMembership(session.userId, session.orgId, [Role.MEMBER]);
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

    const dbRecord = await prisma.flowWorkflow.create({
      data: {
        organizationId: session.orgId,
        name: body.name,
        description: body.description || null,
        status: 'ACTIVE',
        triggerType: body.triggerType || 'Manual',
        definitionJson: JSON.stringify(body.nodes || [])
      }
    });

    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
      dbRecord
    });
  } catch (error: any) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
