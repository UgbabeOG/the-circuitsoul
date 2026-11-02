"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { Shield, ShieldAlert, CheckCircle, RefreshCw, FileDown, Server, Cpu, Database, HelpCircle } from 'lucide-react';

export default function ShieldDashboard() {
  const [loading, setLoading] = useState(false);
  const [vulns, setVulns] = useState<any[]>([]);
  const [remediations, setRemediations] = useState<Record<string, string>>({});
  const [remediationLoading, setRemediationLoading] = useState<Record<string, boolean>>({});
  const [ndprReport, setNdprReport] = useState<any>(null);
  const [ndprLoading, setNdprLoading] = useState(false);

  const [dbConfig, setDbConfig] = useState({
    dbHostingRegion: 'ng-lagos-1',
    encryptionAtRestEnabled: true,
    encryptionInTransitEnabled: true,
    consentLoggingActive: true,
    dataRetentionDays: 365,
    privacyPolicyPublished: true,
    dpoDesignated: false,
    breachNotificationProcessReady: false,
    thirdPartyDataContractsSigned: false
  });

  useEffect(() => {
    fetchVulnerabilities();
    runNdprAudit();
  }, []);

  const fetchVulnerabilities = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shield/vulnerabilities', {
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setVulns(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch vulnerabilities', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerScan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/shield/vulnerabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: 'agent-001' })
      });
      const data = await res.json();
      if (data.success) {
        await fetchVulnerabilities();
      }
    } catch (err) {
      console.error('Scan trigger failed', err);
    } finally {
      setLoading(false);
    }
  };

  const runNdprAudit = async () => {
    setNdprLoading(true);
    try {
      const res = await fetch('/api/shield/ndpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbConfig)
      });
      const data = await res.json();
      if (data.success) {
        setNdprReport(data.data);
      }
    } catch (err) {
      console.error('NDPR audit failed', err);
    } finally {
      setNdprLoading(false);
    }
  };

  const fetchAiRemediation = async (vulnId: string, title: string, severity: string) => {
    setRemediationLoading(prev => ({ ...prev, [vulnId]: true }));
    try {
      const res = await fetch('/api/shield/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vulnerabilityTitle: title, severity })
      });
      const data = await res.json();
      if (data.success) {
        setRemediations(prev => ({ ...prev, [vulnId]: data.data.remediation }));
      }
    } catch (err) {
      console.error('AI remediation failed', err);
    } finally {
      setRemediationLoading(prev => ({ ...prev, [vulnId]: false }));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="shield" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
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
              <p className="text-xs text-emerald-400 mt-1">{ndprReport ? ndprReport.compliant ? 'Compliant' : 'Non-compliant' : 'Loading...'}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">Vulnerability Monitoring (Wazuh OSS Engine)</h2>
              {loading ? (
                <div className="py-8 text-center text-slate-500">Querying threat indicators...</div>
              ) : (
                <div className="space-y-4">
                  {vulns.map(v => (
                    <div key={v.id || v.cve} className="border-b border-white/5 pb-4 last:border-0 last:pb-0">
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
                          <div className="text-slate-500 text-xs mt-1">{v.id || v.cve} &bull; status: <span className="text-slate-300 font-semibold">{v.status}</span></div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchAiRemediation(v.id || v.cve, v.title, v.severity)}
                          disabled={remediationLoading[v.id || v.cve]}
                          className="text-xs"
                        >
                          {remediationLoading[v.id || v.cve] ? 'Consulting...' : 'AI Remediation'}
                        </Button>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed mt-2">{v.description}</p>
                      {remediations[v.id || v.cve] && (
                        <div className="mt-3 p-3 bg-cyan-950/20 border border-cyan-500/10 rounded-lg text-xs">
                          <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                            <Cpu className="w-3.5 h-3.5" /> AI Recommended Remediation:
                          </h4>
                          <div className="text-slate-300 whitespace-pre-line leading-relaxed">{remediations[v.id || v.cve]}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <h2 className="text-lg font-bold text-white mb-4">NDPR Sovereignty</h2>
              <div className="space-y-4 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="text-slate-400 font-semibold">DB Hosting Region</label>
                  <input
                    type="text"
                    value={dbConfig.dbHostingRegion}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, dbHostingRegion: e.target.value }))}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Encryption at Rest</span>
                  <input
                    type="checkbox"
                    checked={dbConfig.encryptionAtRestEnabled}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, encryptionAtRestEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Encryption In Transit</span>
                  <input
                    type="checkbox"
                    checked={dbConfig.encryptionInTransitEnabled}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, encryptionInTransitEnabled: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Consent Logging Audited</span>
                  <input
                    type="checkbox"
                    checked={dbConfig.consentLoggingActive}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, consentLoggingActive: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Privacy Policy Published</span>
                  <input
                    type="checkbox"
                    checked={dbConfig.privacyPolicyPublished}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, privacyPolicyPublished: e.target.checked }))}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Data Retention (days)</span>
                  <input
                    type="number"
                    value={dbConfig.dataRetentionDays}
                    onChange={(e) => setDbConfig(prev => ({ ...prev, dataRetentionDays: parseInt(e.target.value) || 365 }))}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-cyan-500 w-20"
                  />
                </div>
                {ndprReport && (
                  <div className="pt-4 border-t border-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-300">Compliance Score:</span>
                      <span className={`font-black text-sm ${ndprReport.compliant ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ndprReport.overallScore}/100
                      </span>
                    </div>
                    <div className="space-y-2">
                      {ndprReport.pillars?.map((p: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${p.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-slate-400 text-xs">{p.pillar}</span>
                        </div>
                      ))}
                    </div>
                    {ndprReport.requiredRemediations?.length > 0 && (
                      <div className="mt-2 p-2 bg-red-950/20 border border-red-500/10 rounded text-red-300 leading-normal">
                        <strong>Remediation:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          {ndprReport.requiredRemediations.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
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
