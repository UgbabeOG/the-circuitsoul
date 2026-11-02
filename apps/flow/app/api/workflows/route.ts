import { NextResponse } from 'next/server';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { prisma } from '@circuitsoul/db';
import { parseSession } from '@circuitsoul/auth';

export async function GET(request: Request) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    const workflows = await flowAdapter.getWorkflows();
    const templates = flowAdapter.getTemplates();

    // Try to enrich with database workflows if available
    let dbWorkflows: any[] = [];
    try {
      if (session?.orgId) {
        dbWorkflows = await prisma.flowWorkflow.findMany({
          where: { organizationId: session.orgId },
          include: { executions: { take: 5, orderBy: { startedAt: 'desc' } } }
        });
      }
    } catch {
      // Prisma DB might not be seeded in mock/dev mode, continue gracefully
    }

    return NextResponse.json({
      success: true,
      workflows,
      dbWorkflows,
      templates,
      count: workflows.length
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = parseSession(Object.fromEntries(request.headers.entries()));
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { success: false, error: 'Workflow name is required' },
        { status: 400 }
      );
    }

    // Provision workflow via n8n adapter
    const newWorkflow = await flowAdapter.createWorkflow({
      name: body.name,
      description: body.description,
      templateId: body.templateId,
      nodes: body.nodes,
      triggerType: body.triggerType
    });

    // Attempt to persist in Prisma if organization exists
    let dbRecord = null;
    try {
      if (session?.orgId) {
        dbRecord = await prisma.flowWorkflow.create({
          data: {
            organizationId: session.orgId,
            name: body.name,
            description: body.description || null,
            status: 'ACTIVE',
            triggerType: body.triggerType || 'Manual',
            definitionJson: JSON.stringify(body.nodes || [])
          }
        });
      }
    } catch {
      // Dev/mock mode fallback
    }

    return NextResponse.json({
      success: true,
      workflow: newWorkflow,
      dbRecord
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create workflow' },
      { status: 500 }
    );
  }
}
