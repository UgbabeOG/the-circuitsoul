export const mockN8n = {
  async triggerWorkflow(workflowId: string, payload: any) {
    console.log(`[MOCK N8N] Triggering workflow ${workflowId} with payload:`, payload);
    return {
      executionId: Math.random().toString(36).substring(7),
      status: 'SUCCESS',
      output: { message: "Workflow executed successfully (Mock Mode)", data: payload },
      timestamp: new Date().toISOString()
    };
  },

  async getWorkflowStatus(workflowId: string) {
    console.log(`[MOCK N8N] Querying status for workflow ${workflowId}`);
    return {
      id: workflowId,
      name: "Mock Flow Automator",
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
};
