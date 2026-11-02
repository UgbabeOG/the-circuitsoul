import { N8nAdapter } from './n8n';
import { WazuhAdapter } from './wazuh';
import { PrometheusAdapter } from './prometheus';
import { GhostAdapter } from './ghost';

const USE_MOCK_ENGINES = process.env.USE_MOCK_ENGINES !== 'false';

export const flowAdapter = new N8nAdapter(USE_MOCK_ENGINES);
export const shieldAdapter = new WazuhAdapter(USE_MOCK_ENGINES);
export const opsAdapter = new PrometheusAdapter(USE_MOCK_ENGINES);
export const blogAdapter = new GhostAdapter(USE_MOCK_ENGINES);

export { N8nAdapter } from './n8n';
export { WazuhAdapter } from './wazuh';
export { PrometheusAdapter } from './prometheus';
export { GhostAdapter } from './ghost';
export type { N8nWorkflowTemplate } from './mocks/n8n.mock';
export { CURATED_AUTOMATION_TEMPLATES } from './mocks/n8n.mock';
