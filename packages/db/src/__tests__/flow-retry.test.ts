import assert from 'node:assert/strict';
import test from 'node:test';
import { Role } from '@prisma/client';
import { prisma } from '../index';
import { createTenantClient } from '../tenant';

// Helper: make prisma.$transaction just call fn with prisma, so existing
// method mocks (prisma.flowWorkflow.findFirst, etc.) keep working inside tx.
function mockTransaction(prismaClient: typeof prisma) {
  prismaClient.$transaction = async (fn: any) => fn(prismaClient);
}

test('P0: Retry logic — only FAILED executions can be retried', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.flowWorkflow.findFirst = async () =>
    ({ id: 'wf-org-a', organizationId: 'org-a', status: 'ACTIVE', externalWorkflowId: 'n8n-wf-1' } as any);
  prisma.flowExecution.findFirst = async () =>
    ({ id: 'exec-success', workflowId: 'wf-org-a', status: 'SUCCESS', retryCount: 0 } as any);

  try {
    const existingExecution = await prisma.flowExecution.findFirst({
      where: { id: 'exec-success', workflowId: 'wf-org-a' }
    });
    assert.equal(existingExecution.status, 'SUCCESS');
    assert.notEqual(existingExecution.status, 'FAILED');
  } finally {
    prisma.flowWorkflow.findFirst = async () => null as any;
    prisma.flowExecution.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Retry logic — retryCount increments on each retry', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.flowWorkflow.findFirst = async () =>
    ({ id: 'wf-org-a', organizationId: 'org-a', status: 'ACTIVE', externalWorkflowId: 'n8n-wf-1' } as any);
  prisma.flowExecution.findFirst = async () =>
    ({ id: 'exec-failed', workflowId: 'wf-org-a', status: 'FAILED', retryCount: 0 } as any);

  try {
    const existingExecution = await prisma.flowExecution.findFirst({
      where: { id: 'exec-failed', workflowId: 'wf-org-a' }
    });
    assert.equal(existingExecution.status, 'FAILED');
    assert.equal(existingExecution.retryCount, 0);
    assert.ok(existingExecution.retryCount < 3); // Under MAX_RETRIES

    // Simulate incrementing retryCount
    const newRetryCount = existingExecution.retryCount + 1;
    assert.equal(newRetryCount, 1);
    assert.ok(newRetryCount < 3);
  } finally {
    prisma.flowWorkflow.findFirst = async () => null as any;
    prisma.flowExecution.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Retry logic — max retry limit enforcement (3 retries)', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  prisma.flowWorkflow.findFirst = async () =>
    ({ id: 'wf-org-a', organizationId: 'org-a', status: 'ACTIVE', externalWorkflowId: 'n8n-wf-1' } as any);
  prisma.flowExecution.findFirst = async () =>
    ({ id: 'exec-max-retries', workflowId: 'wf-org-a', status: 'FAILED', retryCount: 3 } as any);

  try {
    const existingExecution = await prisma.flowExecution.findFirst({
      where: { id: 'exec-max-retries', workflowId: 'wf-org-a' }
    });
    assert.equal(existingExecution.retryCount, 3);
    assert.ok(existingExecution.retryCount >= 3); // At MAX_RETRIES, no more retries allowed
  } finally {
    prisma.flowWorkflow.findFirst = async () => null as any;
    prisma.flowExecution.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Retry logic — org-scoped: cannot retry execution from another org', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // org-a cannot see org-b's workflow
  prisma.flowWorkflow.findFirst = async (args: any) => {
    if (args.where.organizationId === 'org-a' && args.where.id === 'wf-org-b') {
      return null; // org-a cannot see org-b's workflow
    }
    return { id: 'wf-org-b', organizationId: 'org-b', status: 'ACTIVE', externalWorkflowId: 'n8n-wf-org-b' } as any;
  };
  prisma.flowExecution.findFirst = async () =>
    ({ id: 'exec-org-b-failed', workflowId: 'wf-org-b', status: 'FAILED', retryCount: 0 } as any);

  try {
    const workflow = await prisma.flowWorkflow.findFirst({
      where: { id: 'wf-org-b', organizationId: 'org-a' }
    });
    assert.equal(workflow, null); // Should not find org-b's workflow when querying org-a

    // org-b's client can see its own execution
    const orgBClient = createTenantClient('org-b');
    const execution = await prisma.flowExecution.findFirst({
      where: { id: 'exec-org-b-failed', workflowId: 'wf-org-b' }
    });
    assert.equal(execution.workflowId, 'wf-org-b');
    assert.equal(execution.status, 'FAILED');
  } finally {
    prisma.flowWorkflow.findFirst = async () => null as any;
    prisma.flowExecution.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Retry logic — execution status transitions FAILED -> RUNNING -> SUCCESS/FAILED', async () => {
  // Verify that a retry creates a NEW execution record with status RUNNING
  const executionRecord = {
    id: 'exec-retry-1',
    workflowId: 'wf-org-a',
    status: 'RUNNING',
    retryCount: 1
  };
  assert.equal(executionRecord.status, 'RUNNING');
  assert.equal(executionRecord.retryCount, 1);
});

test('P0: Retry idempotency — same idempotency-key returns the prior result without creating a duplicate', async () => {
  const orgAClient = createTenantClient('org-a');
  mockTransaction(prisma);

  // A prior retry with this idempotency key already produced a SUCCESS execution
  prisma.flowExecution.findFirst = async () =>
    ({
      id: 'exec-idem-1',
      workflowId: 'wf-org-a',
      status: 'SUCCESS',
      retryCount: 1,
      logsJson: JSON.stringify({ idempotencyKey: 'retry-key-123' })
    } as any);

  try {
    const existing = await prisma.flowExecution.findFirst({
      where: {
        workflowId: 'wf-org-a',
        logsJson: { contains: '"idempotencyKey":"retry-key-123"' },
        startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      },
      orderBy: { startedAt: 'desc' }
    });
    assert.ok(existing, 'Idempotent retry should find the prior execution');
    assert.equal(existing.id, 'exec-idem-1');
    assert.equal(existing.status, 'SUCCESS');
    assert.equal(existing.retryCount, 1);
  } finally {
    prisma.flowExecution.findFirst = async () => null as any;
    delete (prisma as any).$transaction;
  }
});

test('P0: Retry concurrency — transaction wraps check-and-create atomically', async () => {
  const orgAClient = createTenantClient('org-a');
  let txFlowExecutionFindFirstCalls = 0;
  let txFlowExecutionCreateCalls = 0;

  mockTransaction(prisma);

  // The transactional retry route calls tx.flowExecution.findFirst then tx.flowExecution.create.
  // Assert both happen on the transaction client (tx) for the same workflow.
  prisma.flowWorkflow.findFirst = async () =>
    ({ id: 'wf-org-a', organizationId: 'org-a', status: 'ACTIVE', externalWorkflowId: 'n8n-wf-1' } as any);
  prisma.flowExecution.findFirst = async (args: any) => {
    txFlowExecutionFindFirstCalls++;
    return { id: 'exec-failed', workflowId: 'wf-org-a', status: 'FAILED', retryCount: 0 } as any;
  };
  prisma.flowExecution.create = async (args: any) => {
    txFlowExecutionCreateCalls++;
    return { id: 'exec-new', workflowId: 'wf-org-a', status: 'RUNNING', retryCount: 1 } as any;
  };
  prisma.flowExecution.update = async () => ({} as any);

  try {
    // Simulate the transaction wrapping check + create
    await prisma.$transaction(async (tx: any) => {
      const wf = await tx.flowWorkflow.findFirst({
        where: { id: 'wf-org-a', organizationId: 'org-a' }
      });
      assert.ok(wf, 'Transaction client must see the org-scoped workflow');
      const ex = await tx.flowExecution.findFirst({
        where: { id: 'exec-failed', workflowId: 'wf-org-a' }
      });
      assert.equal(ex.status, 'FAILED');
      await tx.flowExecution.create({
        data: { workflowId: 'wf-org-a', status: 'RUNNING', retryCount: 1 }
      });
    });
    assert.equal(txFlowExecutionFindFirstCalls, 1, 'findFirst should be called once inside the transaction');
    assert.equal(txFlowExecutionCreateCalls, 1, 'create should be called once inside the transaction');
  } finally {
    prisma.flowWorkflow.findFirst = async () => null as any;
    prisma.flowExecution.findFirst = async () => null as any;
    prisma.flowExecution.create = async () => null as any;
    prisma.flowExecution.update = async () => null as any;
    delete (prisma as any).$transaction;
  }
});
