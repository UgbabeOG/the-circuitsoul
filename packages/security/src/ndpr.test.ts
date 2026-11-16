import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateNDPRCompliance, type NDPRAssessmentInput } from './ndpr';

test('NDPR: af-south-1 (Cape Town, South Africa) is NOT classified as a Nigerian hosting region', () => {
  const input: NDPRAssessmentInput = {
    organizationName: 'Test Org',
    dbHostingRegion: 'af-south-1',
    isDataInAdequacyZone: false,
    encryptionAtRestEnabled: true,
    encryptionInTransitEnabled: true,
    consentLoggingActive: true,
    dataRetentionDays: 365,
    privacyPolicyPublished: true,
    dpoDesignated: true,
    breachNotificationProcessReady: true,
    thirdPartyDataContractsSigned: true
  };

  const report = evaluateNDPRCompliance(input);

  // af-south-1 alone should NOT satisfy data sovereignty without adequacy zone
  assert.ok(
    !report.pillars[0].passed,
    'af-south-1 (Cape Town) should not satisfy Nigerian data residency without adequacy zone confirmation'
  );
  // Findings should state it violates (not satisfies) residency
  assert.ok(
    report.pillars[0].findings.includes('violates'),
    'Findings should state af-south-1 violates cross-border data transfer limitations'
  );
});

test('NDPR: Nigerian region (ng-lagos-1) satisfies data sovereignty without adequacy zone', () => {
  const input: NDPRAssessmentInput = {
    organizationName: 'Test Org',
    dbHostingRegion: 'ng-lagos-1',
    isDataInAdequacyZone: false,
    encryptionAtRestEnabled: true,
    encryptionInTransitEnabled: true,
    consentLoggingActive: true,
    dataRetentionDays: 365,
    privacyPolicyPublished: true,
    dpoDesignated: true,
    breachNotificationProcessReady: true,
    thirdPartyDataContractsSigned: true
  };

  const report = evaluateNDPRCompliance(input);
  assert.ok(report.pillars[0].passed, 'Nigerian region should satisfy data sovereignty');
});

test('NDPR: assessment is self-reported and not a certification', () => {
  const input: NDPRAssessmentInput = {
    organizationName: 'Test Org',
    dbHostingRegion: 'ng-lagos-1',
    isDataInAdequacyZone: true,
    encryptionAtRestEnabled: true,
    encryptionInTransitEnabled: true,
    consentLoggingActive: true,
    dataRetentionDays: 365,
    privacyPolicyPublished: true,
    dpoDesignated: true,
    breachNotificationProcessReady: true,
    thirdPartyDataContractsSigned: true
  };

  const report = evaluateNDPRCompliance(input);
  assert.equal(report.assessmentType, 'SELF_REPORTED');
  assert.ok(report.disclaimer.includes('not a certification'), 'Disclaimer must state not a certification');
  assert.ok(report.disclaimer.includes('independently verified'), 'Disclaimer must state not independently verified');
});

test('NDPR: distinguishes self-reported answers from verified evidence', () => {
  const input: NDPRAssessmentInput = {
    organizationName: 'Test Org',
    dbHostingRegion: 'eu-west-1',
    isDataInAdequacyZone: false,
    encryptionAtRestEnabled: false,
    encryptionInTransitEnabled: false,
    consentLoggingActive: false,
    dataRetentionDays: 2000,
    privacyPolicyPublished: false,
    dpoDesignated: false,
    breachNotificationProcessReady: false,
    thirdPartyDataContractsSigned: false
  };

  const report = evaluateNDPRCompliance(input);
  // All pillars should fail with all-false input
  assert.ok(report.pillars.every((p) => !p.passed), 'All pillars should fail with all-false input');
  assert.equal(report.overallScore, 0, 'Score should be 0 with all controls disabled');
  assert.ok(report.requiredRemediations.length > 0, 'Should have remediation recommendations');
  // Tier should be NON_COMPLIANT
  assert.equal(report.tier, 'NON_COMPLIANT');
});
