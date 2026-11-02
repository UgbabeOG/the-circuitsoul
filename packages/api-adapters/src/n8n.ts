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
    const response = await axios.get(`${this.baseUrl}/workflows`, {
      headers: this.getHeaders()
    });
    return response.data?.data || [];
  }

  async getWorkflow(workflowId: string) {
    if (this.isMock) {
      return mockN8n.getWorkflow(workflowId);
    }
    const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`, {
      headers: this.getHeaders()
    });
    return response.data;
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
  }

  async toggleWorkflowStatus(workflowId: string, status: 'ACTIVE' | 'INACTIVE') {
    if (this.isMock) {
      return mockN8n.toggleWorkflowStatus(workflowId, status);
    }
    const endpoint = status === 'ACTIVE' ? 'activate' : 'deactivate';
    const response = await axios.post(`${this.baseUrl}/workflows/${workflowId}/${endpoint}`, {}, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async triggerWorkflow(workflowId: string, payload: any, triggerSource = 'MANUAL_CONSOLE') {
    if (this.isMock) {
      return mockN8n.triggerWorkflow(workflowId, payload, triggerSource);
    }
    // n8n executes workflows via webhook, not a REST trigger endpoint.
    // Use the configured webhook URL for execution.
    const webhookUrl = `${this.webhookBaseUrl}/${workflowId}`;
    const response = await axios.post(webhookUrl, payload, {
      headers: this.getHeaders()
    });
    return response.data;
  }

  async getExecutions(workflowId?: string) {
    if (this.isMock) {
      return mockN8n.getExecutions(workflowId);
    }
    const params = workflowId ? { workflowId } : {};
    const response = await axios.get(`${this.baseUrl}/executions`, {
      headers: this.getHeaders(),
      params
    });
    return response.data?.data || [];
  }

  async getWorkflowStatus(workflowId: string) {
    if (this.isMock) {
      return mockN8n.getWorkflowStatus(workflowId);
    }
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
  }

  private getHeaders() {
    return {
      'X-N8N-API-KEY': this.apiKey,
      'Content-Type': 'application/json'
    };
  }
}
