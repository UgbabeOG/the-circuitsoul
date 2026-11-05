"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Cloud, Cpu, HardDrive, RefreshCw, Zap } from 'lucide-react';
import { Button, Card, Navbar } from '@circuitsoul/ui';

type CloudEnvironment = {
  id: string;
  provider: string;
  name: string;
  status: string;
};

type ResourceMetrics = {
  state: 'live' | 'demo' | 'unavailable';
  cpu: number | null;
  memory: number | null;
  timestamp: string | null;
};

export default function CloudOpsDashboard() {
  const [environments, setEnvironments] = useState<CloudEnvironment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
  const [error, setError] = useState('');
  const [optimization, setOptimization] = useState('');
  const [optLoading, setOptLoading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/environments')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Unable to load environments');
        return result.environments as CloudEnvironment[];
      })
      .then((items) => {
        if (!active) return;
        setEnvironments(items);
        setSelectedEnvironmentId((current) => current || items[0]?.id || '');
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unable to load environments');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedEnvironmentId) {
      setMetrics(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setOptimization('');
    fetch(`/api/metrics?hostId=${encodeURIComponent(selectedEnvironmentId)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Metrics unavailable');
        return result.data as ResourceMetrics;
      })
      .then((result) => {
        if (active) setMetrics(result);
      })
      .catch((cause: unknown) => {
        if (active) {
          setMetrics({ state: 'unavailable', cpu: null, memory: null, timestamp: null });
          setError(cause instanceof Error ? cause.message : 'Metrics unavailable');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [selectedEnvironmentId, refreshCount]);

  const selectedEnvironment = environments.find((environment) => environment.id === selectedEnvironmentId);

  const getAiOptimization = async () => {
    if (!selectedEnvironmentId || metrics?.state !== 'live' || metrics.cpu === null || metrics.memory === null) return;
    setOptLoading(true);
    setError('');
    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ environmentId: selectedEnvironmentId })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Optimization unavailable');
      setOptimization(result.data.optimization);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Optimization unavailable');
    } finally {
      setOptLoading(false);
    }
  };

  const MetricCard = ({ title, value, icon }: { title: string; value: number | null; icon: React.ReactNode }) => (
    <Card>
      <div className="flex justify-between items-start mb-4">
        <span className="text-slate-400 text-xs font-bold uppercase">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-black text-white">{value === null ? 'Unavailable' : `${value.toFixed(1)}%`}</div>
      {value !== null && (
        <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="cloudops" />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Cloud className="w-8 h-8 text-cyan-400" />
              CloudOps Resource Center
            </h1>
            <p className="text-slate-400 text-sm">Organization-scoped Prometheus telemetry. Cost and service health are not inferred.</p>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedEnvironmentId}
              onChange={(event) => setSelectedEnvironmentId(event.target.value)}
              className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-cyan-500"
              aria-label="Cloud environment"
            >
              <option value="">Select an environment</option>
              {environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.name} ({environment.provider})
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => setRefreshCount((count) => count + 1)} disabled={loading || !selectedEnvironmentId}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {error && <p role="alert" className="text-sm text-amber-300">{error}</p>}
        {!environments.length && !error && (
          <Card className="text-slate-400">No cloud environments are registered for this organization.</Card>
        )}
        {selectedEnvironment && (
          <Card>
            <div className="flex flex-wrap gap-3 items-center text-sm text-slate-300">
              <span className="font-semibold">{selectedEnvironment.name}</span>
              <span>{selectedEnvironment.provider}</span>
              <span className="text-slate-500">Configured status: {selectedEnvironment.status}</span>
              <span className={`uppercase text-xs font-bold ${metrics?.state === 'live' ? 'text-emerald-400' : metrics?.state === 'demo' ? 'text-amber-300' : 'text-slate-400'}`}>
                Metrics: {loading ? 'loading' : metrics?.state || 'unavailable'}
              </span>
              {metrics?.timestamp && <span className="text-xs text-slate-500">Observed {new Date(metrics.timestamp).toLocaleString()}</span>}
            </div>
          </Card>
        )}

        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricCard title="CPU utilization" value={metrics.cpu} icon={<Cpu className="w-4 h-4 text-cyan-400" />} />
            <MetricCard title="Memory utilization" value={metrics.memory} icon={<HardDrive className="w-4 h-4 text-cyan-400" />} />
          </div>
        )}

        <Card>
          <h2 className="text-lg font-bold text-white mb-2">Service health</h2>
          <p className="text-sm text-slate-400">Unavailable: this integration does not currently collect service health checks, uptime, or SLA evidence.</p>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-400" /> AI Cost Optimization
          </h2>
          <p className="text-slate-400 text-xs mb-4">Recommendations are available only from complete live Prometheus utilization metrics; demo and unavailable readings are not sent for optimization.</p>
          {optimization && <div className="p-3 bg-cyan-950/20 border border-cyan-500/10 rounded-lg text-xs leading-relaxed text-slate-300 whitespace-pre-line">{optimization}</div>}
          {!optimization && <div className="py-8 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs"><AlertTriangle className="w-8 h-8 mb-2 text-slate-600" />No recommendations loaded</div>}
          <Button
            variant="glow-cyan"
            onClick={getAiOptimization}
            disabled={optLoading || metrics?.state !== 'live' || metrics.cpu === null || metrics.memory === null}
            className="w-full justify-center gap-2 mt-4"
          >
            {optLoading ? 'Analyzing...' : 'Generate Optimization Report'}
          </Button>
        </Card>
      </main>
    </div>
  );
}
