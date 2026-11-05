export interface NDPRAssessmentInput {
  organizationName: string;
  dbHostingRegion: string;
  isDataInAdequacyZone: boolean;
  encryptionAtRestEnabled: boolean;
  encryptionInTransitEnabled: boolean;
  consentLoggingActive: boolean;
  dataRetentionDays: number;
  privacyPolicyPublished: boolean;
  dpoDesignated: boolean;
  breachNotificationProcessReady: boolean;
  thirdPartyDataContractsSigned: boolean;
}

export interface NDPRCheckPillar {
  pillar: string;
  weight: number;
  score: number;
  maxScore: number;
  passed: boolean;
  regulatoryReference: string;
  findings: string;
  remediation?: string;
}

export interface NDPRComplianceAssessment {
  organizationName: string;
  timestamp: string;
  overallScore: number;
  compliant: boolean;
  tier: 'FULL_COMPLIANCE' | 'SUBSTANTIAL_COMPLIANCE' | 'NON_COMPLIANT';
  pillars: NDPRCheckPillar[];
  requiredRemediations: string[];
  assessmentType: 'SELF_REPORTED';
  disclaimer: string;
}

export function evaluateNDPRCompliance(input: NDPRAssessmentInput): NDPRComplianceAssessment {
  const pillars: NDPRCheckPillar[] = [];
  const requiredRemediations: string[] = [];

  // Pillar 1: Data Sovereignty & Cross-Border Transfer (Section 41-43 NDPA 2023)
  const isRegionLocal =
    input.dbHostingRegion.toLowerCase().startsWith('ng') ||
    input.dbHostingRegion.toLowerCase().includes('nigeria') ||
    input.dbHostingRegion.toLowerCase().includes('lagos') ||
    input.dbHostingRegion.toLowerCase().includes('af-south-1');

  const p1Passed = isRegionLocal || input.isDataInAdequacyZone;
  const p1Score = p1Passed ? 25 : 0;
  if (!p1Passed) {
    requiredRemediations.push(
      'Migrate primary customer databases to AWS af-south-1, ng-lagos-1, or a jurisdiction recognized by the NDPC as having an adequate level of protection (Section 41, NDPA 2023).'
    );
  }
  pillars.push({
    pillar: 'Data Sovereignty & Cross-Border Residency',
    weight: 25,
    score: p1Score,
    maxScore: 25,
    passed: p1Passed,
    regulatoryReference: 'NDPA 2023, Sections 41-43 & NDPR 2019, Reg 2.11',
    findings: p1Passed
      ? `Primary database location (${input.dbHostingRegion}) satisfies statutory residency and adequacy benchmarks.`
      : `Database location (${input.dbHostingRegion}) violates cross-border data transfer limitations.`,
    remediation: !p1Passed ? 'Relocate database storage nodes to authorized regional boundaries.' : undefined
  });

  // Pillar 2: Technical & Cryptographic Safeguards (Section 39 NDPA 2023)
  let p2Score = 0;
  if (input.encryptionAtRestEnabled) p2Score += 15;
  if (input.encryptionInTransitEnabled) p2Score += 10;
  const p2Passed = p2Score === 25;
  if (!input.encryptionAtRestEnabled) {
    requiredRemediations.push('Implement AES-256 transparent data encryption (TDE) for all persistent database storage volumes.');
  }
  if (!input.encryptionInTransitEnabled) {
    requiredRemediations.push('Enforce TLS 1.3 encryption across all public ingress gateways and internal microservice APIs.');
  }
  pillars.push({
    pillar: 'Technical & Cryptographic Safeguards',
    weight: 25,
    score: p2Score,
    maxScore: 25,
    passed: p2Passed,
    regulatoryReference: 'NDPA 2023, Section 39(1)(a) & (b)',
    findings: `Encryption-at-rest: ${input.encryptionAtRestEnabled ? 'ACTIVE (AES-256)' : 'INACTIVE'}. In-transit TLS: ${input.encryptionInTransitEnabled ? 'ACTIVE (TLS 1.3)' : 'INACTIVE'}.`,
    remediation: !p2Passed ? 'Activate end-to-end encryption across compute and persistent storage.' : undefined
  });

  // Pillar 3: Lawful Processing & Explicit Consent (Section 25 NDPA 2023)
  let p3Score = 0;
  if (input.consentLoggingActive) p3Score += 15;
  if (input.privacyPolicyPublished) p3Score += 10;
  const p3Passed = p3Score === 25;
  if (!input.consentLoggingActive) {
    requiredRemediations.push('Implement tamper-evident consent logging recording user timestamp, IP, and consented processing categories.');
  }
  if (!input.privacyPolicyPublished) {
    requiredRemediations.push('Publish a statutory Privacy Notice detailing personal data categories, purposes, and third-party recipients.');
  }
  pillars.push({
    pillar: 'Lawful Processing & Consent Logging',
    weight: 25,
    score: p3Score,
    maxScore: 25,
    passed: p3Passed,
    regulatoryReference: 'NDPA 2023, Section 25 & NDPR 2019, Reg 2.1',
    findings: `Consent Logging: ${input.consentLoggingActive ? 'VERIFIED' : 'DEFICIENT'}. Published Privacy Policy: ${input.privacyPolicyPublished ? 'CONFIRMED' : 'MISSING'}.`,
    remediation: !p3Passed ? 'Deploy opt-in consent capture widgets and immutable audit logging.' : undefined
  });

  // Pillar 4: Governance, Retention & Incident Response (Section 34-40 NDPA 2023)
  let p4Score = 0;
  const retentionValid = input.dataRetentionDays <= 1095; // max 3 years without active justification
  if (retentionValid) p4Score += 10;
  if (input.dpoDesignated) p4Score += 5;
  if (input.breachNotificationProcessReady) p4Score += 5;
  if (input.thirdPartyDataContractsSigned) p4Score += 5;
  const p4Passed = p4Score === 25;

  if (!retentionValid) {
    requiredRemediations.push(`Data retention period of ${input.dataRetentionDays} days exceeds statutory maximum (1,095 days). Implement automated archival/purging.`);
  }
  if (!input.dpoDesignated) {
    requiredRemediations.push('Designate a qualified Data Protection Officer (DPO) and register contact details with the NDPC.');
  }
  if (!input.breachNotificationProcessReady) {
    requiredRemediations.push('Establish an incident response procedure capable of notifying the NDPC and affected data subjects within 72 hours of a breach.');
  }

  pillars.push({
    pillar: 'Data Governance, Retention & Incident Readiness',
    weight: 25,
    score: p4Score,
    maxScore: 25,
    passed: p4Passed,
    regulatoryReference: 'NDPA 2023, Sections 32, 34, 40',
    findings: `Retention schedule: ${input.dataRetentionDays} days (${retentionValid ? 'COMPLIANT' : 'EXCESSIVE'}). DPO: ${input.dpoDesignated ? 'ASSIGNED' : 'UNASSIGNED'}. 72hr Breach Procedure: ${input.breachNotificationProcessReady ? 'READY' : 'ABSENT'}.`,
    remediation: !p4Passed ? 'Adopt automated retention schedules and formalize the 72-hour breach escalation playbook.' : undefined
  });

  const overallScore = p1Score + p2Score + p3Score + p4Score;
  const tier: 'FULL_COMPLIANCE' | 'SUBSTANTIAL_COMPLIANCE' | 'NON_COMPLIANT' =
    overallScore >= 90
      ? 'FULL_COMPLIANCE'
      : overallScore >= 65
      ? 'SUBSTANTIAL_COMPLIANCE'
      : 'NON_COMPLIANT';

  return {
    organizationName: input.organizationName,
    timestamp: new Date().toISOString(),
    overallScore,
    compliant: overallScore >= 80,
    tier,
    pillars,
    requiredRemediations,
    assessmentType: 'SELF_REPORTED',
    disclaimer: 'This is a self-reported readiness assessment. Responses and supporting evidence have not been independently verified. It is not a certification, regulatory approval, or substitute for advice from an accredited data protection professional.'
  };
}
