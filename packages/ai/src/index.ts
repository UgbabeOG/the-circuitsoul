import OpenAI from 'openai';

export class AiService {
  private client: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }

  async generateBlogDraft(topic: string, keywords: string[]): Promise<string> {
    const prompt = `Write a comprehensive, premium-quality blog draft about: ${topic}. Focus keywords: ${keywords.join(', ')}. Include sections, code examples if appropriate, and keep the tone professional yet accessible for SaaS developers.`;
    
    if (this.client) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.choices[0]?.message?.content || this.getMockBlogDraft(topic);
      } catch {
        return this.getMockBlogDraft(topic);
      }
    }

    return this.getMockBlogDraft(topic);
  }

  async recommendRemediation(vulnerabilityTitle: string, severity: string): Promise<string> {
    const prompt = `Recommend a specific, actionable remediation plan for a security vulnerability: ${vulnerabilityTitle} (Severity: ${severity}). Keep the instructions clear, listing command-line patches and config updates where applicable.`;

    if (this.client) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.choices[0]?.message?.content || this.getMockRemediation(vulnerabilityTitle, severity);
      } catch {
        return this.getMockRemediation(vulnerabilityTitle, severity);
      }
    }

    return this.getMockRemediation(vulnerabilityTitle, severity);
  }

  async recommendCloudOptimization(provider: string, resourceDetails: string): Promise<string> {
    const prompt = `Recommend cost and performance optimization for the following ${provider} setup: ${resourceDetails}. Focus on multi-region configs, CDN caching, and database scaling.`;

    if (this.client) {
      try {
        const response = await this.client.chat.completions.create({
          model: 'gpt-4-turbo',
          messages: [{ role: 'user', content: prompt }]
        });
        return response.choices[0]?.message?.content || this.getMockCloudOptimization(provider);
      } catch {
        return this.getMockCloudOptimization(provider);
      }
    }

    return this.getMockCloudOptimization(provider);
  }

  private getMockBlogDraft(topic: string): string {
    return `
# ${topic}

## Introduction
As SaaS applications scale in emerging markets, building robust, resilient infrastructure is no longer optional. Startups must balance growth targets with data sovereignty compliance under local regulations.

## Practical Steps to Secure Infrastructure
1. **Apply Least Privilege Access Control**: Implement granular IAM roles and lock database instances inside virtual private networks.
2. **Setup High-Fidelity Threat Detection**: Employ security tools like Wazuh or AWS GuardDuty to track anomalies.
3. **Log Everything Securely**: Forward audit logs to encrypted centralized storage with strict data residency rules.

## Conclusion
Building for African startups means optimizing for both local compliance (e.g. NDPR) and globally accepted cloud standards. 
    `.trim();
  }

  private getMockRemediation(vulnerabilityTitle: string, severity: string): string {
    return `
### [MOCK AI] Remediation Plan for ${vulnerabilityTitle} (${severity})

1. **Short-Term Mitigation**:
   - Limit ingress traffic on exposed services via firewall configurations.
   - Run: \`sudo systemctl restart wazuh-agent\` to sync security rules.
2. **Permanent Fix**:
   - Update container base image references to the latest stable build.
   - For Node environments: \`npm audit fix --force\` or upgrade package dependencies.
3. **Audit Verification**:
   - Trigger a vulnerability assessment scan in CircuitSoul Shield dashboard.
    `.trim();
  }

  private getMockCloudOptimization(provider: string): string {
    return `
### [MOCK AI] Cloud Optimization for ${provider}

1. **Cost Savings (-22% projected)**:
   - Identify idle compute instances and scale down to appropriate family sizes.
   - Consolidate active storage nodes into unified regions.
2. **Latency Tuning**:
   - Configure local CDNs close to West African hubs (e.g. AWS CloudFront Edge or local cache endpoints) to optimize response times.
3. **High Availability**:
   - Transition to multi-zone PostgreSQL replication.
    `.trim();
  }
}

export const aiService = new AiService();
