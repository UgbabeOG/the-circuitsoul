import axios from 'axios';
import { mockPrometheus } from './mocks/prometheus.mock';

export class PrometheusAdapter {
  private isMock: boolean;
  private baseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.PROMETHEUS_API_URL || 'http://localhost:9090/api/v1';
  }

  async queryMetric(query: string, time?: string) {
    if (this.isMock) {
      return mockPrometheus.queryMetric(query, time);
    }
    const params: any = { query };
    if (time) params.time = time;
    const response = await axios.get(`${this.baseUrl}/query`, { params });
    return response.data;
  }

  async getResourceMetrics(hostId: string) {
    if (this.isMock) {
      return mockPrometheus.getResourceMetrics(hostId);
    }
    const cpuQuery = `100 * (1 - avg by(instance)(irate(node_cpu_seconds_total{mode="idle",instance="${hostId}"}[5m])))`;
    const memQuery = `100 * (1 - (node_memory_MemAvailable_bytes{instance="${hostId}"} / node_memory_MemTotal_bytes{instance="${hostId}"}))`;
    const [cpuResult, memResult] = await Promise.all([
      this.queryMetric(cpuQuery),
      this.queryMetric(memQuery)
    ]);
    const parseValue = (result: any): number | null => {
      const value = Number(result?.data?.result?.[0]?.value?.[1]);
      return Number.isFinite(value) ? value : null;
    };
    const cpu = parseValue(cpuResult);
    const memory = parseValue(memResult);
    return {
      state: cpu === null && memory === null ? 'unavailable' as const : 'live' as const,
      cpu,
      memory,
      timestamp: new Date().toISOString()
    };
  }
}
