import React from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { Shield, Cloud, RefreshCw, BookOpen, Settings, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="web" />
      
      {/* Hero Section */}
      <header className="py-20 px-6 max-w-6xl mx-auto text-center flex flex-col items-center">
        <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-full text-xs font-semibold tracking-wider mb-4 animate-pulse">
          Venture-Ready Infrastructure for Africa
        </span>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
          Next-Gen Infrastructure <br />
          For <span className="gradient-text-blue">African Startups</span>
        </h1>
        <p className="text-slate-400 max-w-2xl text-lg mb-8 leading-relaxed">
          Scale your SaaS while conforming to NDPR data sovereignty regulations. Spin up decoupled threat monitoring, cost orchestration, automated workflows, and AI-driven growth tools instantly.
        </p>
        <div className="flex gap-4">
          <Button variant="primary" className="px-6 py-3 font-semibold">Get Started</Button>
          <Button variant="outline" className="px-6 py-3 font-semibold">View Docs</Button>
        </div>
      </header>

      {/* Grid of dash accessors */}
      <section className="px-6 max-w-6xl mx-auto py-12 w-full">
        <h2 className="text-2xl font-bold mb-8 text-center text-white">SaaS Infrastructure Suites</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Shield */}
          <Card glowColor="blue" className="flex flex-col justify-between h-64">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Shield className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white">CircuitSoul Shield</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Vulnerability monitoring, security posture scoring, and automated compliance reports verifying NDPR residency bounds.
              </p>
            </div>
            <a href="/shield">
              <Button variant="glow-cyan" className="w-full justify-center">Launch Shield</Button>
            </a>
          </Card>

          {/* CloudOps */}
          <Card glowColor="blue" className="flex flex-col justify-between h-64">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <Cloud className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white">CircuitSoul CloudOps</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Aggregated Prometheus metrics mapping server load, regional edge health, and cost metrics optimizations.
              </p>
            </div>
            <a href="/cloudops">
              <Button variant="glow-cyan" className="w-full justify-center">Launch CloudOps</Button>
            </a>
          </Card>

          {/* Flow */}
          <Card glowColor="blue" className="flex flex-col justify-between h-64">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white">CircuitSoul Flow</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Visual low-code automation worker. Decoupled engine adapter maps trigger hooks securely to internal modules.
              </p>
            </div>
            <a href="/flow">
              <Button variant="glow-cyan" className="w-full justify-center">Launch Flow</Button>
            </a>
          </Card>

          {/* Blog */}
          <Card glowColor="green" className="flex flex-col justify-between h-64">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white">AI Growth Blog</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ingests local search trends to generate highly optimized, high-fidelity technical articles published via Ghost.
              </p>
            </div>
            <a href="/blog">
              <Button variant="glow-emerald" className="w-full justify-center">Launch Blog</Button>
            </a>
          </Card>

          {/* Admin Control Room */}
          <Card glowColor="none" className="flex flex-col justify-between h-64">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                  <Settings className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white">System Admin</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Global overview of multi-tenant nodes, billing metrics, and toggling configuration for isolated submodules.
              </p>
            </div>
            <a href="/admin">
              <Button variant="secondary" className="w-full justify-center">Open Admin</Button>
            </a>
          </Card>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="px-6 max-w-6xl mx-auto py-12 w-full border-t border-white/5">
        <h2 className="text-2xl font-bold mb-4 text-center text-white">Flexible Growth Pricing</h2>
        <p className="text-center text-slate-500 text-sm mb-12">Fair pricing adapted to local startup scaling tiers.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex flex-col justify-between">
            <div>
              <h3 className="text-slate-400 text-sm font-semibold uppercase mb-2">Sandbox</h3>
              <div className="text-3xl font-black text-white mb-4">$0 <span className="text-xs text-slate-500 font-normal">/month</span></div>
              <ul className="space-y-3 mb-8 text-xs text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Isolated sandbox testing</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Mock services enabled</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> 1 User account</li>
              </ul>
            </div>
            <Button variant="outline" className="w-full justify-center">Start Free</Button>
          </Card>

          <Card className="border border-cyan-500/30 shadow-[0_0_20px_rgba(0,210,255,0.05)] relative flex flex-col justify-between">
            <span className="absolute -top-3 right-6 bg-cyan-500 text-slate-950 font-bold px-2 py-0.5 rounded text-2xs uppercase">Popular</span>
            <div>
              <h3 className="text-cyan-400 text-sm font-semibold uppercase mb-2">SME Scale</h3>
              <div className="text-3xl font-black text-white mb-4">$49 <span className="text-xs text-slate-500 font-normal">/month</span></div>
              <ul className="space-y-3 mb-8 text-xs text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Connected live OSS submodules</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> NDPR Compliance Report generator</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Up to 5 team memberships</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Automated AI Blog helper</li>
              </ul>
            </div>
            <Button variant="primary" className="w-full justify-center">Select Plan</Button>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <h3 className="text-slate-400 text-sm font-semibold uppercase mb-2">Startup Elite</h3>
              <div className="text-3xl font-black text-white mb-4">$149 <span className="text-xs text-slate-500 font-normal">/month</span></div>
              <ul className="space-y-3 mb-8 text-xs text-slate-400">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Dedicated Kubernetes multi-tenant auth</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Full audits & Custom adapters</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-cyan-400" /> Unlimited users</li>
              </ul>
            </div>
            <Button variant="outline" className="w-full justify-center">Contact Sales</Button>
          </Card>
        </div>
      </section>

      <footer className="mt-auto py-8 text-center text-slate-600 text-xs border-t border-white/5">
        &copy; {new Date().getFullYear()} CircuitSoul Ltd. All rights reserved. Compliant with NDPR & SaaS best practices.
      </footer>
    </div>
  );
}
