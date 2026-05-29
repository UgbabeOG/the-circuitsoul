export interface NDPRConfig {
  dbHostingRegion: string;
  encryptionAtRestEnabled: boolean;
  consentLoggingActive: boolean;
  dataRetentionDays: number;
}

export interface NDPRReport {
  timestamp: string;
  compliant: boolean;
  score: number;
  checks: {
    dbHosting: { passed: boolean; details: string };
    encryption: { passed: boolean; details: string };
    consent: { passed: boolean; details: string };
    retention: { passed: boolean; details: string };
  };
  remediations: string[];
}

export function generateNDPRReport(config: NDPRConfig): NDPRReport {
  const checks = {
    dbHosting: {
      passed: config.dbHostingRegion.toLowerCase().startsWith('ng') || 
              config.dbHostingRegion.toLowerCase().includes('nigeria') || 
              config.dbHostingRegion.toLowerCase().includes('lagos'),
      details: `Database hosted in region: ${config.dbHostingRegion}. NDPR mandates local residency or adequate data protection regulations.`
    },
    encryption: {
      passed: config.encryptionAtRestEnabled,
      details: config.encryptionAtRestEnabled 
        ? "Encryption at rest is active on primary databases." 
        : "Encryption at rest is inactive."
    },
    consent: {
      passed: config.consentLoggingActive,
      details: config.consentLoggingActive
        ? "Explicit user consent is logged for all processing activities."
        : "Consent logging is inactive."
    },
    retention: {
      passed: config.dataRetentionDays <= 1095,
      details: `Data retention is configured for ${config.dataRetentionDays} days.`
    }
  };

  let score = 0;
  const remediations: string[] = [];

  if (checks.dbHosting.passed) score += 25;
  else remediations.push("Migrate primary tenant database to a local Nigerian hosting provider or verified adequacy region.");

  if (checks.encryption.passed) score += 25;
  else remediations.push("Enable AES-256 transparent data encryption (TDE) on PostgreSQL databases.");

  if (checks.consent.passed) score += 25;
  else remediations.push("Implement opt-in cookie banners and log acceptance of terms/privacy policy in Audit logs.");

  if (checks.retention.passed) score += 25;
  else remediations.push("Shorten retention period or automate deletion/anonymization logs.");

  return {
    timestamp: new Date().toISOString(),
    compliant: score === 100,
    score,
    checks,
    remediations
  };
}
