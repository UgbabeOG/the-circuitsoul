"use client";

import React, { useState } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { flowAdapter } from '@circuitsoul/api-adapters';
import { RefreshCw, Play, Plus, Trash2, ArrowRight, Zap, CheckCircle2, Server } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action';
  name: string;
  config: string;
}

export default function FlowDashboard() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: '1', type: 'trigger', name: 'Shield Threat Alert', config: 'Severity == CRITICAL' },
    { id: '2', type: 'action', name: 'Send Email Notification', config: 'recipient: security-ops@circuitsoul.com' }
  ]);
  const [logs, setLogs] = useState<any[]>([]);
  const [running, setRunning] = useState(false);

  const addNode = (type: 'trigger' | 'action') => {
    const id = (nodes.length + 1).toString();
    const newNode: WorkflowNode = {
      id,
      type,
      name: type === 'trigger' ? 'Webhook Receiver' : 'Post to Slack Workspace',
      config: type === 'trigger' ? 'path: /v1/incoming' : 'channel: #alerts-feed'
    };
    setNodes([...nodes, newNode]);
  };

  const removeNode = (id: string) => {
    setNodes(nodes.filter(node => node.id !== id));
  };

  const executeWorkflow = async () => {
    setRunning(true);
    // Call decoupled n8n API adapter
    const result = await flowAdapter.triggerWorkflow('flow-automator-001', {
      nodes: nodes.map(n => ({ name: n.name, config: n.config }))
    });
    setLogs(prev => [result, ...prev]);
    setRunning(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="flow" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Title */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <RefreshCw className="w-8 h-8 text-cyan-400" />
              Flow Automation Board
            </h1>
            <p className="text-slate-400 text-sm">Decoupled n8n execution worker adapter and trigger triggers pipeline.</p>
          </div>

          <Button 
            variant="glow-cyan" 
            onClick={executeWorkflow} 
            disabled={running || nodes.length < 2}
            className="flex items-center gap-2"
          >
            <Play className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
            Run Test Execution
          </Button>
        </div>

        {/* Builder grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white">Workflow Design Canvas</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addNode('trigger')} className="text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Trigger
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addNode('action')} className="text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Action
                  </Button>
                </div>
              </div>

              {/* Node sequence */}
              <div className="flex flex-col md:flex-row items-center gap-4 py-8 overflow-x-auto justify-center bg-slate-900/30 rounded-xl border border-white/5 relative">
                {nodes.map((node, index) => (
                  <React.Fragment key={node.id}>
                    <div className="relative group p-4 w-60 rounded-lg border border-slate-800 bg-slate-950 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                      <div className="flex justify-between items-start mb-2">
                        <span className={`px-2 py-0.5 rounded text-2xs font-bold uppercase ${
                          node.type === 'trigger' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-500/10 text-indigo-400'
                        }`}>
                          {node.type}
                        </span>
                        <button 
                          onClick={() => removeNode(node.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <h4 className="font-bold text-white text-sm mb-1">{node.name}</h4>
                      <input 
                        type="text" 
                        value={node.config} 
                        onChange={(e) => {
                          const updated = [...nodes];
                          updated[index].config = e.target.value;
                          setNodes(updated);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-2xs text-slate-300 outline-none focus:border-cyan-500" 
                      />
                    </div>
                    {index < nodes.length - 1 && (
                      <ArrowRight className="w-5 h-5 text-slate-600 rotate-90 md:rotate-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </Card>
          </div>

          {/* Logs */}
          <div>
            <Card className="flex flex-col h-full justify-between">
              <div>
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Execution Logs
                </h2>
                <p className="text-slate-400 text-xs mb-4">Latest pipeline execution output from isolated services.</p>

                {logs.length > 0 ? (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {logs.map((log, i) => (
                      <div key={i} className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-2xs text-slate-400 leading-normal">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-300">Run #{log.executionId}</span>
                          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3 h-3" /> {log.status}
                          </span>
                        </div>
                        <p className="text-slate-500">{log.timestamp}</p>
                        <div className="mt-2 bg-slate-950 p-2 rounded text-slate-300 font-mono overflow-x-auto">
                          {JSON.stringify(log.output, null, 2)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 text-xs">
                    <Server className="w-8 h-8 mb-2 text-slate-600 animate-pulse" />
                    No execution history loaded
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
