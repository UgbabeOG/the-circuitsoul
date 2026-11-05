import axios from 'axios';
import { mockWazuh } from './mocks/wazuh.mock';

export class WazuhAdapter {
  private isMock: boolean;
  private baseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.WAZUH_API_URL || 'https://localhost:55000';
  }

  async getVulnerabilities(agentId: string) {
    if (this.isMock) {
      return mockWazuh.getVulnerabilities(agentId);
    }
    const token = await this.getAuthToken();
    const response = await axios.get(`${this.baseUrl}/vulnerability/${agentId}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async triggerScan(agentId: string) {
    if (this.isMock) {
      return mockWazuh.triggerScan(agentId);
    }
    const token = await this.getAuthToken();
    const response = await axios.post(`${this.baseUrl}/syscollector/${agentId}/scan`, {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async verifyAssetAgent(agentId: string, target: string): Promise<boolean> {
    if (this.isMock) return false;
    const token = await this.getAuthToken();
    const response = await axios.get(`${this.baseUrl}/agents/${encodeURIComponent(agentId)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const agent = response.data?.data?.affected_items?.[0];
    if (!agent || typeof agent.name !== 'string' || typeof agent.ip !== 'string') return false;

    const normalizedTarget = target.trim().toLowerCase().replace(/\.$/, '');
    return [agent.name, agent.ip].some(
      (value: string) => value.trim().toLowerCase().replace(/\.$/, '') === normalizedTarget
    );
  }

  private async getAuthToken() {
    const response = await axios.post(`${this.baseUrl}/security/user/authenticate`, {}, {
      auth: {
        username: process.env.WAZUH_USER || '',
        password: process.env.WAZUH_PASSWORD || ''
      }
    });
    return response.data.data.token;
  }
}
