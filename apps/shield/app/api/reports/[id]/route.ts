import { NextResponse } from 'next/server';
import { requireAuthenticatedOrg } from '@circuitsoul/auth';
import { prisma } from '@circuitsoul/db';
import { buildStatutoryNDPRCertificatePdf } from '@circuitsoul/reporting';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session } = await requireAuthenticatedOrg(Object.fromEntries(request.headers.entries()));
    const id = (await params).id;
    const assessment = await prisma.nDPRAssessment.findFirst({
      where: { id, organizationId: session.orgId },
      select: {
        id: true,
        score: true,
        compliant: true,
        answersJson: true,
        remediationsJson: true,
        organizationId: true,
        createdAt: true,
        organization: { select: { name: true } }
      }
    });
    if (!assessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
    }

    const answers = assessment.answersJson ? JSON.parse(assessment.answersJson) as Record<string, unknown> : {};
    const remediations = assessment.remediationsJson
      ? JSON.parse(assessment.remediationsJson) as string[]
      : [];

    // Build pillar data from submitted answers for the statutory certificate
    const isRegionLocal =
      String(answers.dbHostingRegion || '').toLowerCase().startsWith('ng') ||
      String(answers.dbHostingRegion || '').toLowerCase().includes('nigeria') ||
      String(answers.dbHostingRegion || '').toLowerCase().includes('lagos');
    const p1Passed = isRegionLocal || answers.isDataInAdequacyZone === true;
    const p2Passed = answers.encryptionAtRestEnabled === true && answers.encryptionInTransitEnabled === true;
    const p3Passed = answers.consentLoggingActive === true && answers.privacyPolicyPublished === true;
    const retentionValid = Number(answers.dataRetentionDays || 0) <= 1095;
    const p4Passed =
      retentionValid &&
      answers.dpoDesignated === true &&
      answers.breachNotificationProcessReady === true &&
      answers.thirdPartyDataContractsSigned === true;

    const pillars = [
      {
        pillar: 'Data Sovereignty & Cross-Border Residency',
        score: p1Passed ? 25 : 0,
        maxScore: 25,
        regulatoryReference: 'NDPA 2023, Sections 41-43 & NDPR 2019, Reg 2.11',
        findings: p1Passed
          ? `Primary database location (${answers.dbHostingRegion}) satisfies statutory residency and adequacy benchmarks.`
          : `Database location (${answers.dbHostingRegion}) violates cross-border data transfer limitations.`
      },
      {
        pillar: 'Technical & Cryptographic Safeguards',
        score: p2Passed ? 25 : 0,
        maxScore: 25,
        regulatoryReference: 'NDPA 2023, Section 39(1)(a) & (b)',
        findings: `Encryption-at-rest: ${answers.encryptionAtRestEnabled === true ? 'ACTIVE (AES-256)' : 'INACTIVE'}. In-transit TLS: ${answers.encryptionInTransitEnabled === true ? 'ACTIVE (TLS 1.3)' : 'INACTIVE'}.`
      },
      {
        pillar: 'Lawful Processing & Consent Logging',
        score: p3Passed ? 25 : 0,
        maxScore: 25,
        regulatoryReference: 'NDPA 2023, Section 25 & NDPR 2019, Reg 2.1',
        findings: `Consent Logging: ${answers.consentLoggingActive === true ? 'VERIFIED' : 'DEFICIENT'}. Published Privacy Policy: ${answers.privacyPolicyPublished === true ? 'CONFIRMED' : 'MISSING'}.`
      },
      {
        pillar: 'Data Governance, Retention & Incident Readiness',
        score: p4Passed ? 25 : 0,
        maxScore: 25,
        regulatoryReference: 'NDPA 2023, Sections 32, 34, 40',
        findings: `Retention schedule: ${answers.dataRetentionDays} days (${retentionValid ? 'COMPLIANT' : 'EXCESSIVE'}). DPO: ${answers.dpoDesignated === true ? 'ASSIGNED' : 'UNASSIGNED'}. 72hr Breach Procedure: ${answers.breachNotificationProcessReady === true ? 'READY' : 'ABSENT'}.`
      }
    ];

    const pdf = await buildStatutoryNDPRCertificatePdf({
      certificateId: assessment.id,
      organizationName: assessment.organization?.name ?? 'Organization',
      timestamp: assessment.createdAt.toISOString(),
      overallScore: assessment.score,
      compliant: assessment.compliant,
      tier: assessment.score >= 90 ? 'FULL_COMPLIANCE' : assessment.score >= 65 ? 'SUBSTANTIAL_COMPLIANCE' : 'NON_COMPLIANT',
      pillars,
      requiredRemediations: remediations
    });

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
