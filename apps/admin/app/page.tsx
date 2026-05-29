"use client";

import React, { useState } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { Settings, Shield, Sliders, Database, Users, Terminal, HelpCircle } from 'lucide-react';

export default function AdminDashboard() {
  const [useMocks, setUseMocks] = useState(true);
  const [activeTab, setActiveTab] = useState<'system' | 'tenants' | 'logs'>('system');
  
  const [organizations, setOrganizations] = useState([
    { id: 'org-001', name: 'CircuitSoul Ltd', slug: 'circuitsoul', members: 4, plan: 'Startup Elite' },
    { id: 'org-002', name: 'NexaCrude Africa', slug: 'nexacrude', members: 12, plan: 'SME Scale' },
    { id: 'org-003', name: 'Kippa Tech', slug: 'kippa', members: 2, plan: 'Sandbox' }
  ]);

  const [logs, setLogs] = useState([
    { timestamp: '11:51:24', org: 'CircuitSoul Ltd', action: 'USE_MOCK_ENGINES toggled to TRUE', ip: '197.210.64.12' },
    { timestamp: '11:42:01', org: 'NexaCrude Africa', action: 'Shield Vulnerability Scan Triggered', ip: '41.203.78.220' },
    { timestamp: '11:15:30', org: 'Kippa Tech', action: 'Tenant Organization Initialized', ip: '102.89.2.14' }
  ]);

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="admin" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Settings className="w-8 h-8 text-cyan-400" />
            System Control Room
          </h1>
          <p className="text-slate-400 text-sm font-semibold">Central administration panel for managing regional multi-tenancy and decoupled OSS submodules.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 border-b border-white/5 pb-px">
          <Button 
            variant={activeTab === 'system' ? 'glow-cyan' : 'outline'} 
            onClick={() => setActiveTab('system')}
            className="text-xs px-4 py-2"
          >
            <Sliders className="w-4 h-4 mr-1.5" /> System Adapters Settings
          </Button>
          <Button 
            variant={activeTab === 'tenants' ? 'glow-cyan' : 'outline'} 
            onClick={() => setActiveTab('tenants')}
            className="text-xs px-4 py-2"
          >
            <Users className="w-4 h-4 mr-1.5" /> Tenant Organizations
          </Button>
          <Button 
            variant={activeTab === 'logs' ? 'glow-cyan' : 'outline'} 
            onClick={() => setActiveTab('logs')}
            className="text-xs px-4 py-2"
          >
            <Terminal className="w-4 h-4 mr-1.5" /> Platform Audit Trail
          </Button>
        </div>

        {/* Tab Contents */}
        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card glowColor="blue">
                <h2 className="text-lg font-bold text-white mb-4">Infrastructure Adapter Configurations</h2>
                
                <div className="space-y-6 text-sm">
                  {/* Switch */}
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <div>
                      <span className="font-bold text-white block">USE_MOCK_ENGINES Fallback Flag</span>
                      <span className="text-xs text-slate-400">Forces API adapters to run in local mock mode without connecting to live docker engines.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={useMocks}
                      onChange={(e) => {
                        setUseMocks(e.target.checked);
                        // Add to log
                        setLogs(prev => [{
                          timestamp: new Date().toTimeString().split(' ')[0],
                          org: 'System Admin',
                          action: `USE_MOCK_ENGINES toggled to ${e.target.checked.toString().toUpperCase()}`,
                          ip: '127.0.0.1'
                        }, ...prev]);
                      }}
                      className="w-10 h-6 rounded-full bg-slate-800 accent-cyan-500 cursor-pointer"
                    />
                  </div>

                  {/* Engine Details */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">OSS Engine Connections</h3>
                    
                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Flow Engine (n8n Webhooks)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-flow-n8n:5678/api/v1</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${useMocks ? 'bg-cyan-500/15 text-cyan-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {useMocks ? 'MOCKING' : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Shield Engine (Wazuh threat assessment)</span>
                        <span className="text-2xs text-slate-500">https://circuitsoul-shield-wazuh:55000</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${useMocks ? 'bg-cyan-500/15 text-cyan-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {useMocks ? 'MOCKING' : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Ops Engine (Prometheus metrics agent)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-ops-prometheus:9090</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${useMocks ? 'bg-cyan-500/15 text-cyan-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {useMocks ? 'MOCKING' : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-white block text-sm">Growth Blog Engine (Ghost Admin API)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-blog-ghost:2368/ghost/api/v4/admin</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${useMocks ? 'bg-cyan-500/15 text-cyan-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                        {useMocks ? 'MOCKING' : 'CONNECTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Health sidebar */}
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">Database Node info</h2>
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Primary PostgreSQL DB</span>
                    <p className="text-slate-500 text-2xs">Region residency: Lagos, Nigeria</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Traffic Gateway Filter</span>
                    <p className="text-slate-500 text-2xs">HMAC verification: Active</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'tenants' && (
          <Card>
            <h2 className="text-lg font-bold text-white mb-4">Multi-Tenant Management</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 font-bold">
                    <th className="pb-3">Org Name</th>
                    <th className="pb-3">Slug</th>
                    <th className="pb-3">Active Members</th>
                    <th className="pb-3">Subscription Tier</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {organizations.map(org => (
                    <tr key={org.id} className="text-slate-300">
                      <td className="py-3 font-semibold text-white">{org.name}</td>
                      <td className="py-3">{org.slug}</td>
                      <td className="py-3">{org.members} users</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                          org.plan === 'Startup Elite' ? 'bg-cyan-500/10 text-cyan-400' :
                          org.plan === 'SME Scale' ? 'bg-indigo-500/10 text-indigo-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" className="text-2xs">Manage Tenants</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card>
            <h2 className="text-lg font-bold text-white mb-4">Platform Audit Logs (NDPR Compliance Requirement)</h2>
            
            <div className="space-y-3 font-mono text-2xs max-h-[400px] overflow-y-auto pr-1">
              {logs.map((log, i) => (
                <div key={i} className="flex justify-between items-start p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400 leading-normal">
                  <div>
                    <span className="text-slate-500">[{log.timestamp}]</span> &bull; <span className="text-white font-semibold">{log.org}</span>: {log.action}
                  </div>
                  <span className="text-slate-600">{log.ip}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
