"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import {
  RefreshCw,
  Play,
  Plus,
  Trash2,
  ArrowRight,
  Zap,
  CheckCircle2,
  Server,
  Layers,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  CloudLightning,
  CreditCard,
  Radio,
  Check,
  Clock,
  ChevronRight,
  ExternalLink,
  Sliders,
  AlertCircle
} from 'lucide-react';
import type { N8nWorkflowTemplate } from '@circuitsoul/api-adapters';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'filter' | 'transformer';
  name: string;
  service?: string;
  config: string;
}

interface WorkflowItem {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  triggerType: string;
  templateId?: string;
  nodesCount: number;
  createdAt: string;
  lastExecution?: {
    status: string;
    timestamp: string;
    durationMs: number;
  } | null;
}

interface ExecutionLog {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'SUCCESS' | 'FAILED' | 'RUNNING';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  triggerSource: string;
  output: Record<string, any>;
}

export default function FlowDashboard() {
  const [activeTab, setActiveTab] = useState<'workflows' | 'catalog' | 'logs'>('workflows');
  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([]);
  const [templates, setTemplates] = useState<N8nWorkflowTemplate[]>([]);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Custom builder state
  const [showBuilder, setShowBuilder] = useState(false);
  const [customWorkflowName, setCustomWorkflowName] = useState('');
  const [customWorkflowDesc, setCustomWorkflowDesc] = useState('');
  const [builderNodes, setBuilderNodes] = useState<WorkflowNode[]>([
    { id: '1', type: 'trigger', name: 'Shield Security Threat Alert', service: 'WazuhTrigger', config: 'severity in ["HIGH", "CRITICAL"]' },
    { id: '2', type: 'action', name: 'Dispatch Slack Alert to #ops-war-room', service: 'SlackWebhook', config: 'channel: #ops-war-room' }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [wfRes, logsRes] = await Promise.all([
        fetch('/api/workflows').then(r => r.json()),
        fetch('/api/executions').then(r => r.json())
      ]);

      if (wfRes.success) {
        setWorkflows(wfRes.workflows || []);
        setTemplates(wfRes.templates || []);
      }
      if (logsRes.success) {
        setLogs(logsRes.executions || []);
      }
    } catch (err) {
      console.error('Failed to load Flow data', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerExecution = async (workflow: WorkflowItem) => {
    setExecutingId(workflow.id);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: { initiatedBy: 'Customer Console', targetOrg: 'CircuitSoul Sandbox' },
          triggerSource: 'MANUAL_EXECUTION'
        })
      });
      const data = await res.json();
      if (data.success) {
        setLogs(prev => [data.execution, ...prev]);
        setSuccessToast(`Execution #${data.execution.id} for "${workflow.name}" completed in ${data.execution.durationMs}ms`);
        setTimeout(() => setSuccessToast(null), 5000);

        // Update workflow execution badge
        setWorkflows(prev =>
          prev.map(w =>
            w.id === workflow.id
              ? {
                  ...w,
                  lastExecution: {
                    status: 'SUCCESS',
                    timestamp: new Date().toISOString(),
                    durationMs: data.execution.durationMs
                  }
                }
              : w
          )
        );
      }
    } catch (err) {
      console.error('Execution failed', err);
    } finally {
      setExecutingId(null);
    }
  };

  const toggleStatus = async (workflowId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await fetch(`/api/workflows/${workflowId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        setWorkflows(prev =>
          prev.map(w => (w.id === workflowId ? { ...w, status: newStatus } : w))
        );
      }
    } catch (err) {
      console.error('Toggle failed', err);
    }
  };

  const activateTemplate = async (template: N8nWorkflowTemplate) => {
    setLoading(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          templateId: template.id,
          triggerType: template.triggerType,
          nodes: template.nodes
        })
      });
      const data = await res.json();
      if (data.success) {
        setWorkflows(prev => [data.workflow, ...prev]);
        setActiveTab('workflows');
        setSuccessToast(`Successfully provisioned n8n automation service: "${template.name}"`);
        setTimeout(() => setSuccessToast(null), 5000);
      }
    } catch (err) {
      console.error('Failed to activate template', err);
    } finally {
      setLoading(false);
    }
  };

  const createCustomWorkflow = async () => {
    if (!customWorkflowName.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customWorkflowName,
          description: customWorkflowDesc || 'Custom tenant workflow automation',
          triggerType: builderNodes[0]?.name || 'Manual Ingress',
          nodes: builderNodes
        })
      });
      const data = await res.json();
      if (data.success) {
        setWorkflows(prev => [data.workflow, ...prev]);
        setShowBuilder(false);
        setCustomWorkflowName('');
        setCustomWorkflowDesc('');
        setSuccessToast(`Custom workflow "${data.workflow.name}" deployed to n8n engine!`);
        setTimeout(() => setSuccessToast(null), 5000);
      }
    } catch (err) {
      console.error('Failed to create custom workflow', err);
    } finally {
      setLoading(false);
    }
  };

  const getTemplateIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case 'ShieldAlert':
        return <ShieldAlert className="w-5 h-5 text-rose-400" />;
      case 'CloudLightning':
        return <CloudLightning className="w-5 h-5 text-amber-400" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      case 'CreditCard':
        return <CreditCard className="w-5 h-5 text-indigo-400" />;
      default:
        return <Layers className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="flow" />

      {/* Success Notification Banner */}
      {successToast && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-3 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Top Architecture Status Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
                n8n Workflow Engine: Online
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">Venture-Ready Automation Wrapper</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <RefreshCw className="w-7 h-7 text-cyan-400" />
              CircuitSoul Flow Automation
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Turn complex backend open-source engines into turn-key automated services for your team and customers. Powered by decoupled n8n execution workers with usage metering.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={fetchInitialData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Engine
            </Button>
            <Button
              variant="glow-cyan"
              onClick={() => setShowBuilder(true)}
              className="text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Custom Flow
            </Button>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Active Workflows</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {workflows.filter(w => w.status === 'ACTIVE').length} / {workflows.length}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Executions Run</p>
              <h3 className="text-2xl font-black text-white mt-1">{logs.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Avg Execution Time</p>
              <h3 className="text-2xl font-black text-white mt-1">840 ms</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">SaaS Plan Quota</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {logs.length} <span className="text-xs text-slate-400 font-normal">/ 5,000 runs</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-white/5 pb-px">
          <Button
            variant={activeTab === 'workflows' ? 'glow-cyan' : 'outline'}
            onClick={() => setActiveTab('workflows')}
            className="text-xs px-4 py-2"
          >
            <Layers className="w-4 h-4 mr-1.5" />
            My Active Workflows ({workflows.length})
          </Button>
          <Button
            variant={activeTab === 'catalog' ? 'glow-cyan' : 'outline'}
            onClick={() => setActiveTab('catalog')}
            className="text-xs px-4 py-2"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Pre-Built Service Catalog ({templates.length})
          </Button>
          <Button
            variant={activeTab === 'logs' ? 'glow-cyan' : 'outline'}
            onClick={() => setActiveTab('logs')}
            className="text-xs px-4 py-2"
          >
            <Zap className="w-4 h-4 mr-1.5" />
            Live Execution Logs ({logs.length})
          </Button>
        </div>

        {/* TAB 1: WORKFLOWS */}
        {activeTab === 'workflows' && (
          <div className="space-y-4">
            {workflows.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
                <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No Workflows Activated Yet</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
                  Activate one of our high-value pre-built automation services or create a custom workflow for your team.
                </p>
                <Button variant="glow-cyan" onClick={() => setActiveTab('catalog')}>
                  Browse Service Catalog
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {workflows.map(wf => (
                  <Card key={wf.id} glowColor="blue" className="p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span
                          className={`px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${
                            wf.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {wf.status}
                        </span>
                        <span className="text-2xs text-slate-400 flex items-center gap-1">
                          <Radio className="w-2.5 h-2.5 text-cyan-400" />
                          {wf.triggerType}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1">{wf.name}</h3>
                      <p className="text-slate-400 text-xs leading-relaxed mb-4">
                        {wf.description}
                      </p>

                      {wf.lastExecution && (
                        <div className="bg-slate-900/60 p-3 rounded-lg border border-white/5 mb-4 text-xs text-slate-400 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Last run: {new Date(wf.lastExecution.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <span className="font-mono text-cyan-400 text-2xs">
                            {wf.lastExecution.durationMs}ms
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <Button
                        variant="glow-cyan"
                        size="sm"
                        disabled={executingId === wf.id || wf.status !== 'ACTIVE'}
                        onClick={() => triggerExecution(wf)}
                        className="flex-1 justify-center text-xs"
                      >
                        <Play
                          className={`w-3.5 h-3.5 mr-1.5 ${
                            executingId === wf.id ? 'animate-pulse text-cyan-300' : ''
                          }`}
                        />
                        {executingId === wf.id ? 'Executing in n8n...' : 'Run Test Execution'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(wf.id, wf.status)}
                        className="text-xs text-slate-300"
                      >
                        {wf.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SERVICE CATALOG (Curated Templates) */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">Pre-Built Automation Services</h2>
              <p className="text-slate-400 text-sm">
                Production-tested n8n workflow blueprints created specifically for African technology startups and SMEs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map(tmpl => (
                <Card
                  key={tmpl.id}
                  glowColor="blue"
                  className="flex flex-col justify-between p-5 relative overflow-hidden"
                >
                  {tmpl.popular && (
                    <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-2xs font-semibold">
                      POPULAR
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center">
                        {getTemplateIcon(tmpl.icon)}
                      </div>
                      <div>
                        <span className="text-2xs font-bold text-cyan-400 uppercase tracking-wider block">
                          {tmpl.category}
                        </span>
                        <h3 className="font-bold text-white text-base leading-snug">{tmpl.name}</h3>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                      {tmpl.description}
                    </p>

                    <div className="space-y-2 mb-4">
                      <div className="text-2xs uppercase text-slate-400 font-bold tracking-wider">
                        Configured Pipeline Nodes ({tmpl.nodes.length})
                      </div>
                      <div className="space-y-1.5">
                        {tmpl.nodes.map((node, i) => (
                          <div
                            key={node.id}
                            className="flex items-center gap-2 p-2 rounded bg-slate-900/60 border border-white/5 text-2xs text-slate-300"
                          >
                            <span className="w-4 h-4 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center font-mono">
                              {i + 1}
                            </span>
                            <span className="truncate">{node.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-2xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" /> ~{tmpl.estimatedRuntimeMs}ms runtime
                    </span>
                    <Button
                      variant="glow-cyan"
                      size="sm"
                      onClick={() => activateTemplate(tmpl)}
                      className="text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Activate Service
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: EXECUTION LOGS */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Live n8n Execution Audit Logs</h2>
                <p className="text-slate-400 text-xs">
                  Raw telemetry and output packets captured from isolated container executions.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchInitialData} className="text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Telemetry
              </Button>
            </div>

            {logs.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/20">
                <Server className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No executions recorded yet. Run a workflow to view output traces.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map(log => (
                  <Card key={log.id} className="p-4 bg-slate-900/70 border border-white/5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-400">#{log.id}</span>
                        <span className="text-sm font-bold text-white">{log.workflowName}</span>
                        <span className="px-2 py-0.5 rounded text-2xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> {log.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-2xs text-slate-400">
                        <span>Trigger: <strong className="text-slate-300">{log.triggerSource}</strong></span>
                        <span>Duration: <strong className="text-cyan-400">{log.durationMs}ms</strong></span>
                        <span>{new Date(log.startedAt).toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono overflow-x-auto max-h-48">
                      <pre className="text-2xs text-slate-300 leading-relaxed">
                        {JSON.stringify(log.output, null, 2)}
                      </pre>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CUSTOM WORKFLOW BUILDER MODAL */}
        {showBuilder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-cyan-400" />
                    Configure New Automation Service
                  </h3>
                  <p className="text-xs text-slate-400">Define triggers and actions routed through the n8n execution pipeline.</p>
                </div>
                <button
                  onClick={() => setShowBuilder(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-300 block mb-1">Workflow Title</label>
                  <input
                    type="text"
                    placeholder="e.g., Weekly Threat Summary to Slack"
                    value={customWorkflowName}
                    onChange={e => setCustomWorkflowName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-slate-300 block mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Brief description of what this automation service accomplishes"
                    value={customWorkflowDesc}
                    onChange={e => setCustomWorkflowDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-sm text-white outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Node Pipeline Preview */}
                <div>
                  <label className="text-xs font-bold uppercase text-slate-300 block mb-2">Service Nodes</label>
                  <div className="space-y-2">
                    {builderNodes.map((node, index) => (
                      <div
                        key={node.id}
                        className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                              node.type === 'trigger'
                                ? 'bg-cyan-500/10 text-cyan-400'
                                : 'bg-indigo-500/10 text-indigo-400'
                            }`}
                          >
                            {node.type}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-white block">{node.name}</span>
                            <span className="text-2xs text-slate-500 font-mono">{node.config}</span>
                          </div>
                        </div>
                        {builderNodes.length > 2 && (
                          <button
                            onClick={() =>
                              setBuilderNodes(builderNodes.filter(n => n.id !== node.id))
                            }
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <Button variant="outline" size="sm" onClick={() => setShowBuilder(false)}>
                  Cancel
                </Button>
                <Button
                  variant="glow-cyan"
                  size="sm"
                  onClick={createCustomWorkflow}
                  disabled={!customWorkflowName.trim() || loading}
                >
                  Deploy to n8n Engine
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
