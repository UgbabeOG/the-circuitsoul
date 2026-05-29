"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import { blogAdapter } from '@circuitsoul/api-adapters';
import { aiService } from '@circuitsoul/ai';
import { BookOpen, Sparkles, Send, Globe, TrendingUp, RefreshCw, Eye, Edit3 } from 'lucide-react';

export default function BlogDashboard() {
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [draftTitle, setDraftTitle] = useState('Securing Multi-Tenant Cloud Architecture');
  const [keywords, setKeywords] = useState('NDPR compliance, PostgreSQL, Wazuh, docker-compose');
  const [draftContent, setDraftContent] = useState('');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    // Fetch using decoupled Ghost API adapter
    const data = await blogAdapter.getPosts();
    setPosts(data);
    setLoading(false);
  };

  const generateDraft = async () => {
    setLoading(true);
    const keywordsList = keywords.split(',').map(k => k.trim());
    const content = await aiService.generateBlogDraft(draftTitle, keywordsList);
    setDraftContent(content);
    setLoading(false);
  };

  const publishToGhost = async () => {
    if (!draftContent) return;
    setPublishing(true);
    // Publish using decoupled Ghost API adapter
    await blogAdapter.createPost({
      title: draftTitle,
      html: `<div class="ai-post">${draftContent.replace(/\n/g, '<br />')}</div>`,
      status: 'published'
    });
    setDraftContent('');
    // Refresh posts feed
    await fetchPosts();
    setPublishing(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="blog" />

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-8 h-8 text-emerald-400" />
              AI Growth Blog Writer
            </h1>
            <p className="text-slate-400 text-sm">Decoupled Ghost Admin API engine adapter for generating organic SEO growth content.</p>
          </div>

          <Button 
            variant="outline" 
            onClick={fetchPosts} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh Feed
          </Button>
        </div>

        {/* Dashboard contents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI Drafting pane */}
          <div className="lg:col-span-2 space-y-6">
            <Card glowColor="green">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                AI Content Engine
              </h2>
              
              <div className="space-y-4">
                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 font-semibold">Article Title Target</label>
                  <input 
                    type="text" 
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-emerald-500" 
                  />
                </div>

                <div className="flex flex-col gap-1 text-xs">
                  <label className="text-slate-400 font-semibold">Focus SEO Keywords (comma separated)</label>
                  <input 
                    type="text" 
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded p-2 text-white outline-none focus:border-emerald-500" 
                  />
                </div>

                <Button 
                  variant="glow-emerald" 
                  onClick={generateDraft} 
                  disabled={loading || !draftTitle}
                  className="w-full justify-center gap-2"
                >
                  <Edit3 className="w-4 h-4" />
                  Draft Article with AI
                </Button>

                {draftContent && (
                  <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-emerald-400" />
                      Draft Preview
                    </h3>

                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 font-mono text-2xs overflow-y-auto max-h-[300px] whitespace-pre-line leading-relaxed">
                      {draftContent}
                    </div>

                    <Button 
                      variant="primary" 
                      onClick={publishToGhost} 
                      disabled={publishing}
                      className="w-full justify-center gap-2 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    >
                      <Send className="w-4 h-4" />
                      {publishing ? 'Publishing to Ghost...' : 'Publish to Ghost Blog'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Sidebar - Feed and Trends */}
          <div className="space-y-6">
            {/* Search Volume Trends */}
            <Card>
              <h2 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                African SaaS Search Trends
              </h2>

              <div className="space-y-3 text-2xs">
                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">"Data Sovereignty compliance Nigeria"</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    +44% <TrendingUp className="w-3 h-3" />
                  </span>
                </div>

                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                  <span className="text-slate-400">"Wazuh docker security posture"</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    +18% <TrendingUp className="w-3 h-3" />
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400">"n8n webhook triggers setup"</span>
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    +5%
                  </span>
                </div>
              </div>
            </Card>

            {/* Ghost feed */}
            <Card>
              <h2 className="text-sm font-bold text-slate-300 mb-4 uppercase tracking-wider">Ghost Published Articles</h2>

              {loading ? (
                <div className="text-center py-6 text-slate-500 text-xs">Loading posts...</div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <div key={post.id} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <h4 className="font-bold text-white text-xs hover:text-emerald-400 transition-colors">
                        <a href={post.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-slate-500" />
                          {post.title}
                        </a>
                      </h4>
                      <p className="text-2xs text-slate-500 mt-1">published: {new Date(post.published_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
