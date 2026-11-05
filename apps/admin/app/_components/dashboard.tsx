"use client";

import React, { useState } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { Settings, Shield, Sliders, Database, Users, Terminal, HelpCircle } from 'lucide-react';

interface AdminDashboardProps {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    members: number;
    assets: number;
    environments: number;
    workflows: number;
    aiGenerations: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  system: {
    organizations: number;
    users: number;
    memberships: number;
    environments: number;
    workflows: number;
    assessments: number;
  };
  environmentsByStatus: Array<{ status: string; _count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user: { id: string; email: string; name: string | null } | null;
    organization: { id: string; name: string } | null;
  }>;
}

export default function AdminDashboardClient(props: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'system' | 'tenants' | 'logs'>('system');

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="admin" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
            <Settings className="w-8 h-8 text-cyan-400" />
            System Control Room
          </h1>
          <p className="text-slate-400 text-sm font-semibold">
            Central administration panel backed by live database records.
          </p>
        </div>

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

        {activeTab === 'system' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card glowColor="blue">
                <h2 className="text-lg font-bold text-white mb-4">Infrastructure Adapter Configurations</h2>

                <div className="space-y-6 text-sm">
                  <div className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-white/5">
                    <div>
                      <span className="font-bold text-white block">Engine Mode</span>
                      <span className="text-xs text-slate-400">
                        Mock engines are development-only. Production surfaces live engine responses.
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                      process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                        ? 'bg-cyan-500/15 text-cyan-400'
                        : 'bg-emerald-500/15 text-emerald-400'
                    }`}>
                      {process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                        ? 'MOCKING (DEV)'
                        : 'LIVE'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">OSS Engine Connections</h3>

                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Flow Engine (n8n Webhooks)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-flow-n8n:5678/api/v1</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'MOCKING'
                          : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Shield Engine (Wazuh threat assessment)</span>
                        <span className="text-2xs text-slate-500">https://circuitsoul-shield-wazuh:55000</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'MOCKING'
                          : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center border-b border-white/5 pb-3">
                      <div>
                        <span className="font-semibold text-white block text-sm">Ops Engine (Prometheus metrics agent)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-ops-prometheus:9090</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'MOCKING'
                          : 'CONNECTED'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-white block text-sm">Growth Blog Engine (Ghost Admin API)</span>
                        <span className="text-2xs text-slate-500">http://circuitsoul-blog-ghost:2368/ghost/api/v4/admin</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'bg-cyan-500/15 text-cyan-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {process.env.USE_MOCK_ENGINES === 'true' && process.env.NODE_ENV !== 'production'
                          ? 'MOCKING'
                          : 'CONNECTED'}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            <Card>
              <h2 className="text-lg font-bold text-white mb-4">System Health</h2>
              <div className="space-y-4 text-xs">
                <div className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Organizations</span>
                    <p className="text-slate-500 text-2xs">{props.system.organizations} registered</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Security Assessments</span>
                    <p className="text-slate-500 text-2xs">{props.system.assessments} total</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Users</span>
                    <p className="text-slate-500 text-2xs">{props.system.users} total</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-cyan-400" />
                  <div>
                    <span className="text-white font-semibold">Workflows</span>
                    <p className="text-slate-500 text-2xs">{props.system.workflows} total</p>
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
                    <th className="pb-3">Assets</th>
                    <th className="pb-3">Environments</th>
                    <th className="pb-3">Workflows</th>
                    <th className="pb-3">AI Generations</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {props.organizations.map((org) => (
                    <tr key={org.id} className="text-slate-300">
                      <td className="py-3 font-semibold text-white">{org.name}</td>
                      <td className="py-3">{org.slug}</td>
                      <td className="py-3">{org.members} users</td>
                      <td className="py-3">{org.assets}</td>
                      <td className="py-3">{org.environments}</td>
                      <td className="py-3">{org.workflows}</td>
                      <td className="py-3">{org.aiGenerations}</td>
                      <td className="py-3 text-right">
                        <Button variant="outline" size="sm" className="text-2xs">
                          Manage Tenant
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {props.organizations.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-500">
                        No organizations found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'logs' && (
          <Card>
            <h2 className="text-lg font-bold text-white mb-4">Platform Audit Logs (NDPR Compliance Requirement)</h2>

            <div className="space-y-3 font-mono text-2xs max-h-[400px] overflow-y-auto pr-1">
              {props.recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="flex justify-between items-start p-3 bg-slate-900/50 border border-slate-800 rounded-lg text-slate-400 leading-normal"
                >
                  <div>
                    <span className="text-slate-500">[{log.createdAt.toLocaleTimeString()}]</span>
                    &bull;{' '}
                    <span className="text-white font-semibold">
                      {log.organization?.name || 'System'}
                    </span>{': '}
                    {log.action}
                  </div>
                  <span className="text-slate-600">{log.ipAddress || 'N/A'}</span>
                </div>
              ))}
              {props.recentActivity.length === 0 && (
                <div className="p-3 text-slate-500 text-center">No audit activity recorded.</div>
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
