"use client";

import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Cpu, FileDown, RefreshCw, Shield } from 'lucide-react';
import { Button, Card, Navbar } from '@circuitsoul/ui';

type Asset = {
  id: string;
  name: string;
  type: string;
  target: string;
  isAuthorized: boolean;
  verified: boolean;
  agentId: string | null;
};

type Vulnerability = {
  id: string;
  title: string;
  severity: string;
  description: string;
  remediation: string;
  status: string;
};

type Assessment = {
  id: string;
  status: string;
  score: number;
  overallRisk: string;
  isVerifiedTechnical: boolean;
  createdAt: string;
};

type HistoryItem = {
  id: string;
  score: number;
  compliant: boolean;
  createdAt: string;
};

type YesNo = boolean | null;
type NdprForm = {
  dbHostingRegion: string;
  isDataInAdequacyZone: YesNo;
  encryptionAtRestEnabled: YesNo;
  encryptionInTransitEnabled: YesNo;
  consentLoggingActive: YesNo;
  dataRetentionDays: string;
  privacyPolicyPublished: YesNo;
  dpoDesignated: YesNo;
  breachNotificationProcessReady: YesNo;
  thirdPartyDataContractsSigned: YesNo;
};

const initialNdprForm: NdprForm = {
  dbHostingRegion: '',
  isDataInAdequacyZone: null,
  encryptionAtRestEnabled: null,
  encryptionInTransitEnabled: null,
  consentLoggingActive: null,
  dataRetentionDays: '',
  privacyPolicyPublished: null,
  dpoDesignated: null,
  breachNotificationProcessReady: null,
  thirdPartyDataContractsSigned: null
};

async function readJson(response: Response) {
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'Request failed');
  return result;
}

export default function ShieldDashboard() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [source, setSource] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetTarget, setAssetTarget] = useState('');
  const [assetType, setAssetType] = useState('DOMAIN');
  const [ownerAuthorized, setOwnerAuthorized] = useState(false);
  const [agentId, setAgentId] = useState('');
  const [ndprForm, setNdprForm] = useState(initialNdprForm);
  const [ndprAssessment, setNdprAssessment] = useState<any>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [remediation, setRemediation] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAssets = async () => {
    try {
      const result = await readJson(await fetch('/api/assets'));
      setAssets(result.assets);
      setSelectedAssetId((current: string) => current || result.assets[0]?.id || '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load assets');
    }
  };

  const loadHistory = async () => {
    try {
      const result = await readJson(await fetch('/api/ndpr'));
      setHistory(result.assessments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load assessment history');
    }
  };

  const loadVulnerabilities = async (assetId: string) => {
    if (!assetId) {
      setVulnerabilities([]);
      setAssessment(null);
      return;
    }
    try {
      const result = await readJson(await fetch(`/api/vulnerabilities?assetId=${encodeURIComponent(assetId)}`));
      setVulnerabilities(result.data || []);
      setAssessment(result.assessment || null);
      setSource(result.source || '');
      setError('');
    } catch (cause) {
      setVulnerabilities([]);
      setAssessment(null);
      setError(cause instanceof Error ? cause.message : 'Assessment unavailable');
    }
  };

  useEffect(() => {
    void loadAssets();
    void loadHistory();
  }, []);

  useEffect(() => {
    void loadVulnerabilities(selectedAssetId);
  }, [selectedAssetId]);

  const registerAsset = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: assetName,
          target: assetTarget,
          type: assetType,
          isAuthorized: ownerAuthorized
        })
      });
      const result = await readJson(response);
      setAssets((current) => [result.asset, ...current]);
      setSelectedAssetId(result.asset.id);
      setAssetName('');
      setAssetTarget('');
      setOwnerAuthorized(false);
      setNotice('Asset registered. It is not verified until its Wazuh agent mapping is confirmed.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset registration failed');
    } finally {
      setBusy(false);
    }
  };

  const verifyAsset = async () => {
    if (!selectedAssetId) return;
    setBusy(true);
    setError('');
    try {
      const result = await readJson(await fetch(`/api/assets/${selectedAssetId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      }));
      setAssets((current) => current.map((asset) => asset.id === result.asset.id ? result.asset : asset));
      setNotice('Wazuh agent verified against the registered asset target.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Asset verification failed');
    } finally {
      setBusy(false);
    }
  };

  const triggerScan = async () => {
    if (!selectedAssetId) return;
    setBusy(true);
    setError('');
    try {
      const result = await readJson(await fetch('/api/vulnerabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: selectedAssetId })
      }));
      setAssessment(result.assessment);
      setSource(result.source);
      setNotice('Scan accepted. Refresh assessment findings after the scanner completes.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scan unavailable');
    } finally {
      setBusy(false);
    }
  };

  const runNdprAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const input = {
        ...ndprForm,
        dataRetentionDays: Number(ndprForm.dataRetentionDays),
        isDataInAdequacyZone: ndprForm.isDataInAdequacyZone,
        encryptionAtRestEnabled: ndprForm.encryptionAtRestEnabled,
        encryptionInTransitEnabled: ndprForm.encryptionInTransitEnabled,
        consentLoggingActive: ndprForm.consentLoggingActive,
        privacyPolicyPublished: ndprForm.privacyPolicyPublished,
        dpoDesignated: ndprForm.dpoDesignated,
        breachNotificationProcessReady: ndprForm.breachNotificationProcessReady,
        thirdPartyDataContractsSigned: ndprForm.thirdPartyDataContractsSigned
      };
      const result = await readJson(await fetch('/api/ndpr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      }));
      setNdprAssessment(result.assessment);
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Assessment failed');
    } finally {
      setBusy(false);
    }
  };

  const getRemediation = async (findingId: string) => {
    setBusy(true);
    setError('');
    try {
      const result = await readJson(await fetch('/api/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vulnerabilityId: findingId })
      }));
      setRemediation((current) => ({ ...current, [findingId]: result.data.remediation }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Remediation unavailable');
    } finally {
      setBusy(false);
    }
  };

  const YesNoField = ({ label, value, onChange }: { label: string; value: YesNo; onChange: (value: YesNo) => void }) => (
    <label className="flex items-center justify-between gap-3 text-slate-400">
      {label}
      <select
        required
        value={value === null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value === 'true')}
        className="bg-slate-900 border border-slate-800 rounded p-2 text-white"
      >
        <option value="">Select</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="shield" />
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <header className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2"><Shield className="w-8 h-8 text-cyan-400" />Shield Security Center</h1>
            <p className="text-slate-400 text-sm">Evidence from an authorized Wazuh scan and clearly identified self-reported controls.</p>
          </div>
          <Button variant="outline" onClick={() => void loadVulnerabilities(selectedAssetId)} disabled={busy || !selectedAssetId}>
            <RefreshCw className="w-4 h-4 mr-2" />Refresh findings
          </Button>
        </header>

        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        {notice && <p role="status" className="text-sm text-cyan-300">{notice}</p>}

        <Card>
          <h2 className="text-lg font-bold text-white mb-4">Register an asset</h2>
          <form onSubmit={registerAsset} className="grid gap-3 md:grid-cols-4">
            <input required minLength={2} value={assetName} onChange={(event) => setAssetName(event.target.value)} placeholder="Asset name" className="bg-slate-900 border border-slate-800 rounded p-2 text-white" />
            <input required minLength={3} value={assetTarget} onChange={(event) => setAssetTarget(event.target.value)} placeholder="Domain, IP, or target" className="bg-slate-900 border border-slate-800 rounded p-2 text-white" />
            <select value={assetType} onChange={(event) => setAssetType(event.target.value)} className="bg-slate-900 border border-slate-800 rounded p-2 text-white">
              {['DOMAIN', 'IP_ADDRESS', 'WEB_APP', 'DATABASE', 'CLOUD_STORAGE'].map((type) => <option key={type}>{type}</option>)}
            </select>
            <Button type="submit" variant="glow-cyan" disabled={busy || !ownerAuthorized}>Register</Button>
            <label className="md:col-span-4 flex gap-2 text-xs text-slate-400">
              <input type="checkbox" checked={ownerAuthorized} onChange={(event) => setOwnerAuthorized(event.target.checked)} required />
              I am authorized by the asset owner to register and assess this target.
            </label>
          </form>
        </Card>

        <Card>
          <div className="flex flex-wrap justify-between gap-4 items-center">
            <div>
              <h2 className="text-lg font-bold text-white">Asset verification and scan</h2>
              <p className="text-xs text-slate-400">Registration alone never marks an asset as verified.</p>
            </div>
            <select value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)} className="bg-slate-900 border border-slate-800 rounded p-2 text-white" aria-label="Select asset">
              <option value="">Select an asset</option>
              {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} — {asset.target}</option>)}
            </select>
          </div>
          {assets.find((asset) => asset.id === selectedAssetId) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-300">
                {assets.find((asset) => asset.id === selectedAssetId)?.verified ? <CheckCircle className="inline w-4 h-4 text-emerald-400 mr-1" /> : <AlertTriangle className="inline w-4 h-4 text-amber-400 mr-1" />}
                {assets.find((asset) => asset.id === selectedAssetId)?.verified ? 'Verified' : 'Unverified'}
              </span>
              <input value={agentId} onChange={(event) => setAgentId(event.target.value)} placeholder="Wazuh agent ID" className="bg-slate-900 border border-slate-800 rounded p-2 text-white" />
              <Button variant="outline" onClick={verifyAsset} disabled={busy || !agentId}>Verify agent mapping</Button>
              <Button variant="glow-cyan" onClick={triggerScan} disabled={busy || !assets.find((asset) => asset.id === selectedAssetId)?.verified}>Run authorized scan</Button>
            </div>
          )}
        </Card>

        {assessment && (
          <Card>
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">Technical assessment</h2>
                <p className="text-xs text-slate-400">Status: {assessment.status} · Source: {source || (assessment.isVerifiedTechnical ? 'live' : 'demo')}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">{assessment.status === 'COMPLETED' ? `${assessment.score}/100` : 'Not scored'}</div>
                <div className="text-xs text-slate-400">Risk: {assessment.overallRisk}</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Score formula: 100 minus finding weights (critical 30, high 18, medium 8, low 3), bounded at 0. This assessment is not a certification.</p>
            <div className="mt-4 space-y-4">
              {vulnerabilities.map((finding) => (
                <div key={finding.id} className="border-t border-white/10 pt-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <strong className="text-white">{finding.title}</strong>
                      <p className="text-xs text-slate-400 mt-1">{finding.severity} · {finding.status}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void getRemediation(finding.id)} disabled={busy}>
                      <Cpu className="w-4 h-4 mr-1" />AI remediation
                    </Button>
                  </div>
                  <p className="text-sm text-slate-300 mt-2">{finding.description}</p>
                  <p className="text-xs text-slate-400 mt-2">Scanner guidance: {finding.remediation}</p>
                  {remediation[finding.id] && <p className="whitespace-pre-line text-sm text-cyan-200 mt-3">{remediation[finding.id]}</p>}
                </div>
              ))}
              {assessment.status === 'COMPLETED' && !vulnerabilities.length && <p className="text-sm text-emerald-300">No findings were returned by the scanner for this assessment.</p>}
            </div>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-bold text-white mb-2">NDPA / NDPR readiness self-assessment</h2>
          <p className="text-xs text-amber-300 mb-4">Answers are self-reported and not independently verified. Results are not a certification or regulatory approval.</p>
          <form onSubmit={runNdprAssessment} className="grid gap-4 md:grid-cols-2 text-sm">
            <label className="flex flex-col gap-1 text-slate-400">Hosting region<input required minLength={2} value={ndprForm.dbHostingRegion} onChange={(event) => setNdprForm((form) => ({ ...form, dbHostingRegion: event.target.value }))} className="bg-slate-900 border border-slate-800 rounded p-2 text-white" /></label>
            <label className="flex flex-col gap-1 text-slate-400">Retention days<input required type="number" min={1} max={3650} value={ndprForm.dataRetentionDays} onChange={(event) => setNdprForm((form) => ({ ...form, dataRetentionDays: event.target.value }))} className="bg-slate-900 border border-slate-800 rounded p-2 text-white" /></label>
            <YesNoField label="Adequacy zone confirmed" value={ndprForm.isDataInAdequacyZone} onChange={(value) => setNdprForm((form) => ({ ...form, isDataInAdequacyZone: value }))} />
            <YesNoField label="Encryption at rest enabled" value={ndprForm.encryptionAtRestEnabled} onChange={(value) => setNdprForm((form) => ({ ...form, encryptionAtRestEnabled: value }))} />
            <YesNoField label="Encryption in transit enabled" value={ndprForm.encryptionInTransitEnabled} onChange={(value) => setNdprForm((form) => ({ ...form, encryptionInTransitEnabled: value }))} />
            <YesNoField label="Consent logging active" value={ndprForm.consentLoggingActive} onChange={(value) => setNdprForm((form) => ({ ...form, consentLoggingActive: value }))} />
            <YesNoField label="Privacy policy published" value={ndprForm.privacyPolicyPublished} onChange={(value) => setNdprForm((form) => ({ ...form, privacyPolicyPublished: value }))} />
            <YesNoField label="DPO designated" value={ndprForm.dpoDesignated} onChange={(value) => setNdprForm((form) => ({ ...form, dpoDesignated: value }))} />
            <YesNoField label="Breach response process ready" value={ndprForm.breachNotificationProcessReady} onChange={(value) => setNdprForm((form) => ({ ...form, breachNotificationProcessReady: value }))} />
            <YesNoField label="Third-party data contracts signed" value={ndprForm.thirdPartyDataContractsSigned} onChange={(value) => setNdprForm((form) => ({ ...form, thirdPartyDataContractsSigned: value }))} />
            <Button type="submit" variant="glow-cyan" disabled={busy} className="md:col-span-2">Save readiness assessment</Button>
          </form>
          {ndprAssessment && (
            <div className="mt-5 border-t border-white/10 pt-4">
              <h3 className="font-bold text-white">Self-reported score: {ndprAssessment.overallScore}/100</h3>
              <p className="text-xs text-slate-400 mt-1">{ndprAssessment.disclaimer}</p>
              <a className="inline-flex items-center text-cyan-300 text-sm mt-3" href={`/api/reports/${ndprAssessment.id}`}><FileDown className="w-4 h-4 mr-2" />Download assessment report</a>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-white mb-3">Assessment history</h2>
          {history.length ? history.map((item) => (
            <div key={item.id} className="flex flex-wrap justify-between gap-2 border-t border-white/10 py-3 text-sm">
              <span className="text-slate-300">{new Date(item.createdAt).toLocaleString()} · Self-reported score {item.score}/100</span>
              <a className="text-cyan-300" href={`/api/reports/${item.id}`}>Download report</a>
            </div>
          )) : <p className="text-sm text-slate-400">No readiness assessments have been saved.</p>}
        </Card>
      </main>
    </div>
  );
}
