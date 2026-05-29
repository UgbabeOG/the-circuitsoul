import React from 'react';
import { Shield, Cloud, RefreshCw, BookOpen, Settings } from 'lucide-react';

interface NavbarProps {
  activeApp?: 'shield' | 'cloudops' | 'flow' | 'blog' | 'admin' | 'web';
  orgName?: string;
  userName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ activeApp = 'web', orgName = 'CircuitSoul Ltd', userName = 'Developer Admin' }) => {
  return (
    <nav className="w-full glass-panel border-b border-white/5 py-4 px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <a href="/" className="flex items-center gap-2 font-bold text-lg tracking-wider text-white">
          <span className="bg-gradient-to-r from-cyan-400 to-blue-500 w-6 h-6 rounded flex items-center justify-center text-slate-950 font-black text-xs">CS</span>
          Circuit<span className="text-cyan-400">Soul</span>
        </a>

        <div className="hidden md:flex items-center gap-1 text-sm">
          <a
            href="/shield"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'shield' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.05)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Shield
          </a>
          <a
            href="/cloudops"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'cloudops' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.05)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4" />
            CloudOps
          </a>
          <a
            href="/flow"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'flow' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.05)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            Flow
          </a>
          <a
            href="/blog"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'blog' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.05)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Blog
          </a>
          <a
            href="/admin"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeApp === 'admin' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,210,255,0.05)]' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Admin
          </a>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="hidden sm:flex flex-col items-end">
          <span className="text-white font-medium">{userName}</span>
          <span className="text-slate-500 text-xs">{orgName}</span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold">
          {userName.charAt(0)}
        </div>
      </div>
    </nav>
  );
};
