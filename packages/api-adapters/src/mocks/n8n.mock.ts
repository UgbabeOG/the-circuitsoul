export interface N8nWorkflowTemplate {
  id: string;
  slug: string;
  name: string;
  category: 'SECURITY' | 'COMPLIANCE' | 'DEVOPS' | 'MARKETING' | 'FINTECH';
  description: string;
  triggerType: string;
  icon: string;
  nodes: Array<{
    id: string;
    type: 'trigger' | 'action' | 'filter' | 'transformer';
    name: string;
    service: string;
    config: Record<string, any>;
  }>;
  estimatedRuntimeMs: number;
  defaultPayload: Record<string, any>;
  popular?: boolean;
}

export const CURATED_AUTOMATION_TEMPLATES: N8nWorkflowTemplate[] = [
  {
    id: 'tmpl-ndpr-sentinel',
    slug: 'ndpr-sovereignty-sentinel',
    name: 'NDPR Data Sovereignty Sentinel',
    category: 'COMPLIANCE',
    description: 'Continuously monitors PostgreSQL & S3 storage regions in AWS/Azure. Auto-alerts compliance officers on any offshore boundary breach.',
    triggerType: 'Schedule (Every 6 hours)',
    icon: 'ShieldCheck',
    nodes: [
      { id: '1', type: 'trigger', name: 'Cron Schedule (0 */6 * * *)', service: 'CronTrigger', config: { cron: '0 */6 * * *' } },
      { id: '2', type: 'action', name: 'Query AWS/Azure DB Hosting Region', service: 'CircuitSoulOps', config: { target: 'primary-db', inspect: 'region,encryption' } },
      { id: '3', type: 'filter', name: 'Verify Africa/Adequacy Zone (ng-lagos-1)', service: 'Filter', config: { condition: 'region.startsWith("ng") || adequacyZone == true' } },
      { id: '4', type: 'action', name: 'Dispatch NDPR Audit Packet to Slack/Email', service: 'SlackWebhook', config: { channel: '#compliance-alerts', format: 'blocks' } }
    ],
    estimatedRuntimeMs: 820,
    defaultPayload: { organizationId: 'org-demo-001', checkRetention: true, notifySlack: true },
    popular: true
  },
  {
    id: 'tmpl-shield-threat-responder',
    slug: 'shield-threat-auto-responder',
    name: 'Shield Critical Threat Auto-Mitigation',
    category: 'SECURITY',
    description: 'Listens for Wazuh SIEM high/critical vulnerability alarms. Quarantines suspect ingress IPs and notifies the security response team.',
    triggerType: 'Webhook Receiver (/v1/shield-alert)',
    icon: 'ShieldAlert',
    nodes: [
      { id: '1', type: 'trigger', name: 'Shield Webhook Ingress', service: 'Webhook', config: { path: '/v1/shield-alert', method: 'POST' } },
      { id: '2', type: 'filter', name: 'Filter Severity >= HIGH', service: 'Filter', config: { condition: 'severity in ["HIGH", "CRITICAL"]' } },
      { id: '3', type: 'action', name: 'AI Incident Analysis & Remediation Recipe', service: 'OpenAiCompletion', config: { model: 'gpt-4-turbo', prompt: 'Summarize CVE and patch steps' } },
      { id: '4', type: 'action', name: 'Forward Incident to PagerDuty & Security Channel', service: 'PagerDuty', config: { urgency: 'high' } }
    ],
    estimatedRuntimeMs: 1450,
    defaultPayload: { vulnerabilityId: 'CVE-2024-38812', title: 'vCenter Remote Code Execution', severity: 'CRITICAL', agentId: 'agent-lagos-01' },
    popular: true
  },
  {
    id: 'tmpl-cloud-cost-spikeguard',
    slug: 'cloudops-cost-spikeguard',
    name: 'CloudOps Budget & Anomaly Spikeguard',
    category: 'DEVOPS',
    description: 'Tracks Prometheus CPU, egress bandwidth, and daily AWS bill run rate. Automatically alerts founders if daily burn rate surges by >20%.',
    triggerType: 'Prometheus Metric Alert',
    icon: 'CloudLightning',
    nodes: [
      { id: '1', type: 'trigger', name: 'Prometheus Rate Poller', service: 'PrometheusPoller', config: { metric: 'aws_cost_burn_rate_hourly', interval: '15m' } },
      { id: '2', type: 'filter', name: 'Spike Anomaly Detector (> 20% standard deviation)', service: 'AnomalyFilter', config: { threshold: 1.2 } },
      { id: '3', type: 'action', name: 'Generate Cost Optimization Advice', service: 'CircuitSoulAI', config: { target: 'ec2-downscaling' } },
      { id: '4', type: 'action', name: 'Send Executive Digest (SMS & Slack)', service: 'TwilioSms', config: { recipients: ['+234800000000'] } }
    ],
    estimatedRuntimeMs: 640,
    defaultPayload: { currentBurnRate: 142.50, baselineAverage: 95.00, spikePercent: 50.0 },
    popular: false
  },
  {
    id: 'tmpl-ai-ghost-publisher',
    slug: 'ai-trend-ghost-publisher',
    name: 'Autonomous AI Trend Ingestion & Ghost Publisher',
    category: 'MARKETING',
    description: 'Ingests African tech trends from Twitter/X and TechCabal RSS, drafts a high-SEO article with CircuitSoul AI, and publishes a staged draft to Ghost.',
    triggerType: 'RSS / Trend Webhook',
    icon: 'Sparkles',
    nodes: [
      { id: '1', type: 'trigger', name: 'Tech Ingestion RSS Trigger', service: 'RssFeed', config: { url: 'https://techcabal.com/feed/' } },
      { id: '2', type: 'action', name: 'CircuitSoul AI Article Generator', service: 'CircuitSoulAI', config: { tone: 'Technical Founder', targetLength: 1200 } },
      { id: '3', type: 'transformer', name: 'Convert Markdown to Ghost Mobiledoc', service: 'CodeNode', config: { language: 'javascript' } },
      { id: '4', type: 'action', name: 'Publish Staged Draft to Ghost Admin API', service: 'GhostAdminApi', config: { status: 'draft', tags: ['Cloud', 'Africa', 'NDPR'] } }
    ],
    estimatedRuntimeMs: 3100,
    defaultPayload: { topic: 'Microservices in Africa: Overcoming Low-Bandwidth Edges', keywords: ['lagos cloud', 'ndpr compliance', 'low latency'] },
    popular: false
  },
  {
    id: 'tmpl-fintech-reconciler',
    slug: 'paystack-flutterwave-reconciler',
    name: 'Paystack / Flutterwave Payment Reconciler',
    category: 'FINTECH',
    description: 'Receives webhook events for successful customer payments, verifies HMAC signature, credits tenant quota, and issues a branded PDF receipt.',
    triggerType: 'Payment Gateway Webhook',
    icon: 'CreditCard',
    nodes: [
      { id: '1', type: 'trigger', name: 'Paystack/Flutterwave Webhook Ingress', service: 'Webhook', config: { path: '/v1/paystack-hook' } },
      { id: '2', type: 'action', name: 'Verify HMAC SHA512 Signature', service: 'SecurityGateway', config: { header: 'x-paystack-signature' } },
      { id: '3', type: 'action', name: 'Update Subscription Status & Reset Quota', service: 'PrismaDb', config: { model: 'Subscription', action: 'update' } },
      { id: '4', type: 'action', name: 'Generate & Email PDF Invoice', service: 'CircuitSoulReporting', config: { sendEmail: true } }
    ],
    estimatedRuntimeMs: 950,
    defaultPayload: { event: 'charge.success', amount: 5000000, currency: 'NGN', customer: { email: 'billing@startup.ng' } },
    popular: true
  }
];

let inMemoryWorkflows = [
  {
    id: 'flow-001',
    name: 'Daily NDPR Sovereignty Auto-Scan',
    description: 'Validates DB and storage residency compliance across Lagos and Dublin nodes.',
    status: 'ACTIVE',
    triggerType: 'Cron Schedule (Every 6h)',
    templateId: 'tmpl-ndpr-sentinel',
    nodesCount: 4,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastExecution: {
      status: 'SUCCESS',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      durationMs: 780
    }
  },
  {
    id: 'flow-002',
    name: 'Shield Threat Critical Notification',
    description: 'Immediately routes Wazuh high severity CVE alerts to Slack security channel.',
    status: 'ACTIVE',
    triggerType: 'Webhook Ingress',
    templateId: 'tmpl-shield-threat-responder',
    nodesCount: 4,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    lastExecution: {
      status: 'SUCCESS',
      timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      durationMs: 1220
    }
  },
  {
    id: 'flow-003',
    name: 'CloudOps Cost Spike Alerter',
    description: 'Detects unexpected daily spend surges over AWS and Azure.',
    status: 'DRAFT',
    triggerType: 'Prometheus Poller',
    templateId: 'tmpl-cloud-cost-spikeguard',
    nodesCount: 4,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastExecution: null
  }
];

let inMemoryExecutions: Array<{
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  triggerSource: string;
  output: Record<string, any>;
}> = [
  {
    id: 'exec-8491',
    workflowId: 'flow-001',
    workflowName: 'Daily NDPR Sovereignty Auto-Scan',
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 18 + 780).toISOString(),
    durationMs: 780,
    triggerSource: 'CRON_SCHEDULE',
    output: {
      verifiedRegions: ['ng-lagos-1 (AWS Africa)', 'dublin-replication-02 (EU-Adequate)'],
      complianceScore: 100,
      violatingEntities: 0,
      notificationSent: true,
      channel: '#compliance-alerts'
    }
  },
  {
    id: 'exec-8490',
    workflowId: 'flow-002',
    workflowName: 'Shield Threat Critical Notification',
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    completedAt: new Date(Date.now() - 1000 * 60 * 55 + 1220).toISOString(),
    durationMs: 1220,
    triggerSource: 'WAZUH_WEBHOOK',
    output: {
      cve: 'CVE-2024-38812',
      threatScore: 9.8,
      severity: 'CRITICAL',
      aiRemediationGenerated: true,
      slackMessageId: 'p1718920192',
      pagerDutyIncidentId: 'INC-9382'
    }
  }
];

export const mockN8n = {
  getTemplates(): N8nWorkflowTemplate[] {
    return CURATED_AUTOMATION_TEMPLATES;
  },

  async getWorkflows() {
    return inMemoryWorkflows;
  },

  async getWorkflow(workflowId: string) {
    const found = inMemoryWorkflows.find(w => w.id === workflowId);
    if (!found) {
      return {
        id: workflowId,
        name: 'Custom Flow',
        status: 'ACTIVE',
        triggerType: 'Manual',
        nodesCount: 3,
        createdAt: new Date().toISOString()
      };
    }
    return found;
  },

  async createWorkflow(data: { name: string; description?: string; templateId?: string; nodes?: any[]; triggerType?: string }) {
    const id = `flow-${Math.random().toString(36).substring(2, 8)}`;
    const newWorkflow = {
      id,
      name: data.name,
      description: data.description || 'Custom customer automation workflow',
      status: 'ACTIVE',
      triggerType: data.triggerType || 'Manual Webhook',
      templateId: data.templateId || 'custom',
      nodesCount: data.nodes?.length || 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastExecution: null
    };
    inMemoryWorkflows = [newWorkflow, ...inMemoryWorkflows];
    return newWorkflow;
  },

  async toggleWorkflowStatus(workflowId: string, status: 'ACTIVE' | 'INACTIVE') {
    const idx = inMemoryWorkflows.findIndex(w => w.id === workflowId);
    if (idx !== -1) {
      inMemoryWorkflows[idx].status = status;
      inMemoryWorkflows[idx].updatedAt = new Date().toISOString();
      return inMemoryWorkflows[idx];
    }
    return { id: workflowId, status };
  },

  async triggerWorkflow(workflowId: string, payload: any, triggerSource = 'MANUAL_CONSOLE') {
    console.log(`[MOCK N8N] Triggering workflow ${workflowId} with payload:`, payload);
    const workflow = inMemoryWorkflows.find(w => w.id === workflowId);
    const execId = `exec-${Math.random().toString(36).substring(2, 7)}`;
    const durationMs = Math.floor(Math.random() * 800) + 400;
    const now = new Date();
    const completed = new Date(now.getTime() + durationMs);

    const execution = {
      id: execId,
      workflowId,
      workflowName: workflow?.name || 'Custom Automator',
      status: 'SUCCESS' as const,
      startedAt: now.toISOString(),
      completedAt: completed.toISOString(),
      durationMs,
      triggerSource,
      output: {
        message: 'Workflow successfully executed via CircuitSoul n8n automation engine',
        nodesExecuted: workflow?.nodesCount || 3,
        payloadSnapshot: payload,
        engineTelemetry: {
          nodeEngine: 'n8n-enterprise-worker',
          executionMode: 'isolated-container',
          memoryPeakMb: 42.4
        }
      }
    };

    inMemoryExecutions = [execution, ...inMemoryExecutions];

    if (workflow) {
      workflow.lastExecution = {
        status: 'SUCCESS',
        timestamp: completed.toISOString(),
        durationMs
      };
    }

    return execution;
  },

  async getExecutions(workflowId?: string) {
    if (workflowId) {
      return inMemoryExecutions.filter(e => e.workflowId === workflowId);
    }
    return inMemoryExecutions;
  },

  async getWorkflowStatus(workflowId: string) {
    const wf = inMemoryWorkflows.find(w => w.id === workflowId);
    return {
      id: workflowId,
      name: wf?.name || 'Flow Automator',
      active: wf?.status === 'ACTIVE',
      createdAt: wf?.createdAt || new Date().toISOString(),
      updatedAt: wf?.updatedAt || new Date().toISOString()
    };
  }
};
