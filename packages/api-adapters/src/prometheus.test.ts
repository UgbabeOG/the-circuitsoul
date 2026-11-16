import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { PrometheusAdapter } from './prometheus';

test('PrometheusAdapter: live state when both CPU and memory are available', async () => {
  const adapter = new PrometheusAdapter(false);
  const originalGet = axios.get;
  axios.get = async (url: string, params: any) => {
    if (params.params.query.includes('node_cpu_seconds_total')) {
      return { data: { data: { result: [{ value: [Date.now() / 1000, '45'] }] } } };
    }
    if (params.params.query.includes('node_memory_MemAvailable')) {
      return { data: { data: { result: [{ value: [Date.now() / 1000, '30'] }] } } };
    }
    return { data: { data: { result: [] } } };
  };

  try {
    const result = await adapter.getResourceMetrics('prom-instance-1');
    assert.equal(result.state, 'live');
    assert.equal(result.cpu, 45);
    assert.equal(result.memory, 30);
  } finally {
    axios.get = originalGet;
  }
});

test('PrometheusAdapter: partial state when only CPU is available', async () => {
  const adapter = new PrometheusAdapter(false);
  const originalGet = axios.get;
  axios.get = async (url: string, params: any) => {
    if (params.params.query.includes('node_cpu_seconds_total')) {
      return { data: { data: { result: [{ value: [Date.now() / 1000, '45'] }] } } };
    }
    return { data: { data: { result: [] } } };
  };

  try {
    const result = await adapter.getResourceMetrics('prom-instance-1');
    assert.equal(result.state, 'partial');
    assert.equal(result.cpu, 45);
    assert.equal(result.memory, null);
  } finally {
    axios.get = originalGet;
  }
});

test('PrometheusAdapter: unavailable state when neither metric is available', async () => {
  const adapter = new PrometheusAdapter(false);
  const originalGet = axios.get;
  axios.get = async () => ({
    data: { data: { result: [] } }
  });

  try {
    const result = await adapter.getResourceMetrics('prom-instance-1');
    assert.equal(result.state, 'unavailable');
    assert.equal(result.cpu, null);
    assert.equal(result.memory, null);
  } finally {
    axios.get = originalGet;
  }
});
