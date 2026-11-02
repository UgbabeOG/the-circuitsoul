import axios from 'axios';
import { mockN8n, N8nWorkflowTemplate } from './mocks/n8n.mock';

export class N8nAdapter {
  private isMock: boolean;
  private baseUrl: string;
  private apiKey: string;
  private webhookBaseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
    this.apiKey = process.env.N8N_API_KEY || '';
    this.webhookBaseUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
  }

  getTemplates(): N8nWorkflowTemplate[] {
    return mockN8n.getTemplates();
  }

  async getWorkflows() {
    if (this.isMock) {
      return mockN8n.getWorkflows();
    }
    try {
      const response = await axios.get(`${this.baseUrl}/workflows`, {
        headers: this.getHeaders()
      });
      return response.data?.data || [];
    } catch (err: any) {
      console.warn('[n8nAdapter] Live API getWorkflows failed, falling back to mock:', err.message);
      return mockN8n.getWorkflows();
    }
  }

  async getWorkflow(workflowId: string) {
    if (this.isMock) {
      return mockN8n.getWorkflow(workflowId);
    }
    try {
      const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err: any) {
      console.warn(`[n8nAdapter] Live API getWorkflow(${workflowId}) failed, falling back to mock:`, err.message);
      return mockN8n.getWorkflow(workflowId);
    }
  }

  async createWorkflow(data: {
    name: string;
    description?: string;
    templateId?: string;
    nodes?: any[];
    triggerType?: string;
  }) {
    if (this.isMock) {
      return mockN8n.createWorkflow(data);
    }
    try {
      const payload = {
        name: data.name,
        nodes: data.nodes || [],
        connections: {},
        settings: { executionOrder: 'v1' }
      };
      const response = await axios.post(`${this.baseUrl}/workflows`, payload, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err: any) {
      console.warn('[n8nAdapter] Live API createWorkflow failed, falling back to mock:', err.message);
      return mockN8n.createWorkflow(data);
    }
  }

  async toggleWorkflowStatus(workflowId: string, status: 'ACTIVE' | 'INACTIVE') {
    if (this.isMock) {
      return mockN8n.toggleWorkflowStatus(workflowId, status);
    }
    try {
      const endpoint = status === 'ACTIVE' ? 'activate' : 'deactivate';
      const response = await axios.post(`${this.baseUrl}/workflows/${workflowId}/${endpoint}`, {}, {
        headers: this.getHeaders()
      });
      return response.data;
    } catch (err: any) {
      console.warn(`[n8nAdapter] Live API toggleWorkflowStatus(${workflowId}, ${status}) failed:`, err.message);
      return mockN8n.toggleWorkflowStatus(workflowId, status);
    }
  }

  async triggerWorkflow(workflowId: string, payload: any, triggerSource = 'MANUAL_CONSOLE') {
    if (this.isMock) {
      return mockN8n.triggerWorkflow(workflowId, payload, triggerSource);
    }
    try {
      const response = await axios.post(
        `${this.baseUrl}/workflows/${workflowId}/trigger`,
        { payload, triggerSource },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (err: any) {
      console.warn(`[n8nAdapter] Live API triggerWorkflow(${workflowId}) failed, falling back to mock:`, err.message);
      return mockN8n.triggerWorkflow(workflowId, payload, triggerSource);
    }
  }

  async getExecutions(workflowId?: string) {
    if (this.isMock) {
      return mockN8n.getExecutions(workflowId);
    }
    try {
      const params = workflowId ? { workflowId } : {};
      const response = await axios.get(`${this.baseUrl}/executions`, {
        headers: this.getHeaders(),
        params
      });
      return response.data?.data || [];
    } catch (err: any) {
      console.warn('[n8nAdapter] Live API getExecutions failed, falling back to mock:', err.message);
      return mockN8n.getExecutions(workflowId);
    }
  }

  async getWorkflowStatus(workflowId: string) {
    if (this.isMock) {
      return mockN8n.getWorkflowStatus(workflowId);
    }
    try {
      const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`, {
        headers: this.getHeaders()
      });
      return {
        id: response.data.id,
        name: response.data.name,
        active: response.data.active,
        createdAt: response.data.createdAt,
        updatedAt: response.data.updatedAt
      };
    } catch (err: any) {
      console.warn(`[n8nAdapter] Live API getWorkflowStatus(${workflowId}) failed:`, err.message);
      return mockN8n.getWorkflowStatus(workflowId);
    }
  }

  private getHeaders() {
    return {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json'
    };
  }
}
