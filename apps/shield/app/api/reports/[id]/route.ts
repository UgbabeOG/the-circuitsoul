import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { buildNdprReport } from '@circuitsoul/reporting';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { session } = await requireAuthenticatedOrg(Object.fromEntries(request.headers.entries()));
    const assessment = await prisma.nDPRAssessment.findFirst({
      where: { id: params.id, organizationId: session.orgId }
    });
    if (!assessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    const answers = JSON.parse(assessment.answersJson) as Record<string, unknown>;
    const remediations = assessment.remediationsJson
      ? JSON.parse(assessment.remediationsJson) as string[]
      : [];
    const pdf = await buildNdprReport([
      `Assessment ID: ${assessment.id}`,
      `Assessment date: ${assessment.createdAt.toISOString()}`,
      `Result: ${assessment.score}/100`,
      `Self-reported threshold met: ${assessment.compliant ? 'Yes' : 'No'}`,
      '',
      'Submitted control responses:',
      ...Object.entries(answers).map(([key, value]) => `${key}: ${String(value)}`),
      '',
      'Recommended follow-up:',
      ...(remediations.length ? remediations.map((item) => `- ${item}`) : ['- No follow-up items were generated.']),
      '',
      'This document records a self-reported readiness assessment. It is not a certification or regulatory approval; submitted responses and evidence have not been independently verified.'
    ].join('\n'));

    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="circuitsoul-assessment-${assessment.id}.pdf"`,
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unauthorized')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof Error && error.message.startsWith('TenantAccessDenied')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json({ success: false, error: 'Report generation failed' }, { status: 500 });
  }
}
