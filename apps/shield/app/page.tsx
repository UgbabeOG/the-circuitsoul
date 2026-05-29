"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { shieldAdapter } from '@circuitsoul/api-adapters';
import { generateNDPRReport, NDPRReport } from '@circuitsoul/security';
import { aiService } from '@circuitsoul/ai';
import { Shield, ShieldAlert, CheckCircle, RefreshCw, FileDown, Server, Cpu, Database, HelpCircle } from 'lucide-react';

export default function ShieldDashboard() {
  const [loading, setLoading] = useState(false);
  const [vulns, setVulns] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<Record<string, string>>({});
  const [remediationLoading, setRemediationLoading] = useState<Record<string, boolean>>({});
  const [ndprReport, setNdprReport] = useState<NDPRReport | null>(null);
  
  // Custom mock database config for NDPR Audits
  const [dbConfig, setDbConfig] = useState({
    dbHostingRegion: 'ng-lagos-1',
    encryptionAtRestEnabled: true,
    consentLoggingActive: true,
    dataRetentionDays: 365
  });

  useEffect(() => {
    fetchVulnerabilities();
    runNdprAudit();
  }, []);

  const fetchVulnerabilities = async () => {
    setLoading(true);
    // Fetch using decoupled wazuh API adapter
    const data = await shieldAdapter.getVulnerabilities('agent-001');
    setVulns(data);
    setLoading(false);
  };

  const triggerScan = async () => {
    setLoading(true);
    await shieldAdapter.triggerScan('agent-001');
    // Refresh lists
    await fetchVulnerabilities();
  };

  const runNdprAudit = () => {
    const report = generateNDPRReport(dbConfig);
    setNdprReport(report);
  };

  const fetchAiRemediation = async (vulnId: string, title: string, severity: string) => {
    setRemediationLoading(prev => ({ ...prev, [vulnId]: true }));
    const advice = await aiService.recommendRemediation(title, severity);
    setRemediations(prev => ({ ...prev, [vulnId]: advice }));
    setRemediationLoading(prev => ({ ...prev, [vulnId]: false }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="shield" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <Shield className="w-8 h-8 text-cyan-400" />
              Shield Security Center
            </h1>
            <p className="text-slate-400 text-sm">Real-time container vulnerability assessments and NDPR compliance tracking.</p>
          </div>
          <Button 
            variant="glow-cyan" 
            onClick={triggerScan} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Run Security Scan
          </Button>
        </div>

        {/* Posture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex items-center gap-6">
            <div className="relative w-20 h-20 flex items-center justify-center rounded-full border-4 border-cyan-500/20 shadow-[0_0_15px_rgba(0,210,255,0.1)]">
              <span className="text-2xl font-black text-white">88</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Security Score</h3>
              <p className="text-xs text-cyan-400 mt-1">Excellent (Low threat risk detected)</p>
            </div>
          </Card>

          <Card className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">NDPR Sovereignty</h3>
              <p className="text-xs text-emerald-400 mt-1">100% Compliant (Region locked)</p>
            </div>
          </Card>

          <Card className="flex items-center gap-6">
            <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 animate-pulse">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-400 uppercase tracking-wider">Active Threats</h3>
              <p className="text-xs text-amber-400 mt-1">{vulns.filter(v => v.status === 'OPEN').length} vulnerabilities detected</p>
            </div>
          </Card>
        </div>

        {/* Central columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threats panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">Vulnerability Monitoring (Wazuh OSS Engine)</h2>
              
              {loading ? (
                <div className="py-8 text-center text-slate-500">Querying threat indicators...</div>
              ) : (
                <div className="space-y-4">
                  {vulns.map(v => (
                    <div key={v.id} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className={`px-2 py-0.5 rounded text-2xs font-bold mr-2 uppercase ${
                            v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                            v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {v.severity}
                          </span>
                          <span className="text-white font-semibold text-sm">{v.title}</span>
                          <div className="text-slate-500 text-xs mt-1">{v.id} &bull; status: <span className="text-slate-300 font-semibold">{v.status}</span></div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => fetchAiRemediation(v.id, v.title, v.severity)}
                          disabled={remediationLoading[v.id]}
                          className="text-xs"
                        >
                          {remediationLoading[v.id] ? 'Consulting...' : 'AI Remediation'}
                        </Button>
                      </div>
                      
                      <p className="text-slate-400 text-xs leading-relaxed mt-2">{v.description}</p>

                      {remediations[v.id] && (
                        <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-500/10 rounded-lg text-xs">
                          <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5" /> AI Recommended Remediation:
                          </h4>
                          <div className="text-slate-300 whitespace-pre-line leading-relaxed">{remediations[v.id]}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* NDPR compliance manager */}
          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">NDPR Sovereignty</h2>
              
              <div className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-semibold">DB Hosting Region</label>
                  <input 
                    type="text" 
                    value={dbConfig.dbHostingRegion}
                    onChange={(e) => {
                      setDbConfig(prev => ({ ...prev, dbHostingRegion: e.target.value }));
                      setTimeout(runNdprAudit, 50);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-cyan-500" 
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Encryption at Rest</span>
                  <input 
                    type="checkbox" 
                    checked={dbConfig.encryptionAtRestEnabled}
                    onChange={(e) => {
                      setDbConfig(prev => ({ ...prev, encryptionAtRestEnabled: e.target.checked }));
                      setTimeout(runNdprAudit, 50);
                    }}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Consent Logging Audited</span>
                  <input 
                    type="checkbox" 
                    checked={dbConfig.consentLoggingActive}
                    onChange={(e) => {
                      setDbConfig(prev => ({ ...prev, consentLoggingActive: e.target.checked }));
                      setTimeout(runNdprAudit, 50);
                    }}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>

                {ndprReport && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-300">Compliance Score:</span>
                      <span className={`font-black text-sm ${ndprReport.compliant ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ndprReport.score}/100
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ndprReport.checks.dbHosting.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-slate-400">Residency Region check</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ndprReport.checks.encryption.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-slate-400">AES Encryption check</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${ndprReport.checks.consent.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-slate-400">Consent Log audits</span>
                      </div>
                    </div>

                    {ndprReport.remediations.length > 0 && (
                      <div className="mt-2 p-2 bg-red-950/20 border border-red-500/10 rounded text-red-300 leading-normal">
                        <strong>Remediation:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          {ndprReport.remediations.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <Button 
                      variant="outline" 
                      onClick={() => alert(JSON.stringify(ndprReport, null, 2))}
                      className="w-full justify-center gap-2 mt-2"
                    >
                      <FileDown className="w-4 h-4" /> Download Audits Report
                    </Button>
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
