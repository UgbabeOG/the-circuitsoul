import axios from 'axios';
import { mockN8n } from './mocks/n8n.mock';

export class N8nAdapter {
  private isMock: boolean;
  private baseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.N8N_API_URL || 'http://localhost:5678/api/v1';
  }

  async triggerWorkflow(workflowId: string, payload: any) {
    if (this.isMock) {
      return mockN8n.triggerWorkflow(workflowId, payload);
    }
    const response = await axios.post(`${this.baseUrl}/workflows/${workflowId}/trigger`, payload, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY || ''
      }
    });
    return response.data;
  }

  async getWorkflowStatus(workflowId: string) {
    if (this.isMock) {
      return mockN8n.getWorkflowStatus(workflowId);
    }
    const response = await axios.get(`${this.baseUrl}/workflows/${workflowId}`, {
      headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY || ''
      }
    });
    return response.data;
  }
}
