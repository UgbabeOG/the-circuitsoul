"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { opsAdapter } from '@circuitsoul/api-adapters';
import { aiService } from '@circuitsoul/ai';
import { Cloud, Cpu, HardDrive, DollarSign, Activity, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

export default function CloudOpsDashboard() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [selectedHost, setSelectedHost] = useState('lagos-core-node-01');
  const [optimization, setOptimization] = useState('');
  const [optLoading, setOptLoading] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, [selectedHost]);

  const fetchMetrics = async () => {
    setLoading(true);
    // Fetch using decoupled Prometheus API adapter
    const data = await opsAdapter.getResourceMetrics(selectedHost);
    setMetrics(data);
    setLoading(false);
  };

  const getAiOptimization = async () => {
    if (!metrics) return;
    setOptLoading(true);
    const details = `CPU: ${metrics.cpu}%, MEM: ${metrics.memory}%, Daily Cost: $${metrics.costDaily}`;
    const advice = await aiService.recommendCloudOptimization('AWS/Azure Multi-region (Lagos/Dublin)', details);
    setOptimization(advice);
    setOptLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="cloudops" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Title and selectors */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Cloud className="w-8 h-8 text-cyan-400" />
              CloudOps Resource Center
            </h1>
            <p className="text-slate-400 text-sm">Aggregated metrics from Prometheus OSS and Multi-region Cost Analytics.</p>
          </div>
          
          <div className="flex gap-3">
            <select 
              value={selectedHost} 
              onChange={(e) => setSelectedHost(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded p-2 text-xs text-white outline-none focus:border-cyan-500"
            >
              <option value="lagos-core-node-01">Lagos Edge Node (AWS ng-lagos-1)</option>
              <option value="dublin-replication-02">Dublin Repl. Node (AWS eu-west-1)</option>
              <option value="local-dev-sandbox">Local Dev Sandbox</option>
            </select>
            <Button 
              variant="outline" 
              onClick={fetchMetrics} 
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Dashboard Gauges */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card glowColor="blue">
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 text-xs font-bold uppercase">CPU Load</span>
                <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-white">{metrics.cpu}%</div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${metrics.cpu}%` }} />
              </div>
            </Card>

            <Card glowColor="blue">
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 text-xs font-bold uppercase">Memory Usage</span>
                <HardDrive className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-white">{metrics.memory}%</div>
              <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${metrics.memory}%` }} />
              </div>
            </Card>

            <Card glowColor="none">
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 text-xs font-bold uppercase">Daily Cost Run</span>
                <DollarSign className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-white">${metrics.costDaily}</div>
              <div className="text-2xs text-slate-500 mt-2">Projected monthly: ${(metrics.costDaily * 30).toFixed(2)}</div>
            </Card>

            <Card glowColor="none" className="border-l-4 border-l-cyan-500">
              <div className="flex justify-between items-start mb-4">
                <span className="text-slate-400 text-xs font-bold uppercase">Ops Score</span>
                <Activity className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-3xl font-black text-white">{metrics.score} / 100</div>
              <div className="text-2xs text-cyan-400 mt-2">Status: Optimal health</div>
            </Card>
          </div>
        )}

        {/* Node stats and optimizations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">Monitored Multi-tenant Services</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <span className="text-white font-semibold text-sm">Prisma/PostgreSQL DB Service</span>
                      <p className="text-slate-500 text-2xs">Region: ng-lagos-1 &bull; Active: 120 pods</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">99.98% SLA</span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <span className="text-white font-semibold text-sm">Ghost Admin API Pods</span>
                      <p className="text-slate-500 text-2xs">Region: ng-lagos-1 &bull; Active: 2 instances</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">99.95% SLA</span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <span className="text-white font-semibold text-sm">n8n Execution Worker Cluster</span>
                      <p className="text-slate-500 text-2xs">Region: ng-lagos-1 &bull; Active: 8 cores</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">100.00% SLA</span>
                </div>

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <span className="text-white font-semibold text-sm">Wazuh Threat Posture Daemon</span>
                      <p className="text-slate-500 text-2xs">Region: local-network &bull; Isolated</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">99.90% SLA</span>
                </div>
              </div>
            </Card>
          </div>

          <div>
            <Card className="flex flex-col h-full justify-between">
              <div>
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  AI Cost Optimization
                </h2>
                <p className="text-slate-400 text-xs mb-4">Analyze Prometheus telemetry and recommend cost improvements.</p>
                
                {optimization ? (
                  <div className="p-3 bg-cyan-950/20 border border-cyan-500/10 rounded-lg text-xs leading-relaxed text-slate-300">
                    <div className="whitespace-pre-line">{optimization}</div>
                  </div>
                ) : (
                  <div className="py-12 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs">
                    <AlertTriangle className="w-8 h-8 mb-2 text-slate-600" />
                    No optimizations loaded
                  </div>
                )}
              </div>

              <Button 
                variant="glow-cyan" 
                onClick={getAiOptimization} 
                disabled={optLoading || !metrics}
                className="w-full justify-center gap-2 mt-4"
              >
                {optLoading ? 'Analyzing...' : 'Generate Optimization Report'}
              </Button>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
