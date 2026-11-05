"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Navbar } from '@circuitsoul/ui';
import {
  BookOpen,
  Sparkles,
  Send,
  Globe,
  TrendingUp,
  RefreshCw,
  Eye,
  Edit3,
  ExternalLink,
  CheckCircle2,
  Clock,
  Radio,
  Share2,
  Layers,
  FileText,
  Tag,
  Hash,
  AlertCircle
} from 'lucide-react';
import type { GhostPost, AfricanTechTrend } from '@circuitsoul/api-adapters';

export default function BlogDashboard() {
  const [activeTab, setActiveTab] = useState<'studio' | 'posts' | 'trends'>('studio');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState<GhostPost[]>([]);
  const [trends, setTrends] = useState<AfricanTechTrend[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drafting state
  const [draftTitle, setDraftTitle] = useState('Securing Multi-Tenant Cloud Architecture for African SaaS');
  const [keywords, setKeywords] = useState('NDPR compliance, PostgreSQL, Wazuh, docker-compose, Lagos edge');
  const [draftContent, setDraftContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Security', 'NDPR', 'DevOps']);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [postsRes, trendsRes] = await Promise.all([
        fetch('/api/posts').then(r => r.json()),
        fetch('/api/trends').then(r => r.json())
      ]);

      if (postsRes.success) {
        setPosts(postsRes.posts || []);
      }
      if (trendsRes.success) {
        setTrends(trendsRes.trends || []);
      }
    } catch (err) {
      console.error('Failed to load blog data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTrend = (trend: AfricanTechTrend) => {
    setDraftTitle(trend.topic);
    setKeywords(trend.suggestedKeywords.join(', '));
    setSelectedTags([trend.category, 'African Tech']);
    setActiveTab('studio');
    showToast(`Loaded trending topic: "${trend.topic}"`);
  };

  const generateDraft = async () => {
    if (!draftTitle.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: draftTitle,
          keywords
        })
      });
      const data = await res.json();
      if (data.success) {
        setDraftContent(data.draft.content);
        showToast(`AI generated ${data.draft.wordCount} words (~${data.draft.readingTime} min read)`);
      } else {
        showToast(data.error || 'Generation failed', true);
      }
    } catch (err) {
      console.error('Draft generation error', err);
      showToast('Generation failed, please retry', true);
    } finally {
      setGenerating(false);
    }
  };

  const publishToGhost = async (status: 'draft' | 'published') => {
    if (!draftContent.trim() || !draftTitle.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftTitle,
          content: draftContent,
          status,
          tags: selectedTags,
          excerpt: draftContent.replace(/<[^>]*>/g, '').substring(0, 160) + '...'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          status === 'published'
            ? `Post published live to Ghost CMS: "${data.post.title}"`
            : `Post saved as draft in Ghost CMS`
        );
        await fetchInitialData();
        if (status === 'published') {
          setActiveTab('posts');
        }
      } else {
        showToast(data.error || 'Publishing failed', true);
      }
    } catch (err) {
      console.error('Publishing error', err);
      showToast('Publishing failed, please retry', true);
    } finally {
      setPublishing(false);
    }
  };

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const wordCount = draftContent.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className="flex flex-col min-h-screen bg-navy-950">
      <Navbar activeApp="blog" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-3 text-emerald-300 text-sm">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Architecture Status */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-5 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                Ghost CMS Engine: Connected
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-slate-400 text-xs">Admin API v5 JWT Gateway</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <BookOpen className="w-7 h-7 text-emerald-400" />
              AI Growth Blog & Ghost Publisher
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Autonomous organic SEO growth writer. Ingests local African developer and regulatory trends, drafts high-fidelity technical articles with AI, and stages or publishes directly to your Ghost CMS instance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchInitialData}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Sync Ghost
            </Button>
            <a
              href="http://localhost:2368/ghost"
              target="_blank"
              rel="noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" />
                Ghost Admin
              </Button>
            </a>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Published Posts</p>
              <h3 className="text-2xl font-black text-white mt-1">{posts.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Active Trends Ingested</p>
              <h3 className="text-2xl font-black text-white mt-1">{trends.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Average SEO Score</p>
              <h3 className="text-2xl font-black text-white mt-1">94%</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </Card>

          <Card glowColor="none" className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold text-slate-400">Monthly Ghost Limit</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {posts.length} <span className="text-xs text-slate-400 font-normal">/ 500 posts</span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Tab Controls */}
        <div className="flex gap-2 border-b border-white/5 pb-px">
          <Button
            variant={activeTab === 'studio' ? 'glow-emerald' : 'outline'}
            onClick={() => setActiveTab('studio')}
            className="text-xs px-4 py-2"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            AI Content Studio
          </Button>
          <Button
            variant={activeTab === 'posts' ? 'glow-emerald' : 'outline'}
            onClick={() => setActiveTab('posts')}
            className="text-xs px-4 py-2"
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            Ghost Articles Feed ({posts.length})
          </Button>
          <Button
            variant={activeTab === 'trends' ? 'glow-emerald' : 'outline'}
            onClick={() => setActiveTab('trends')}
            className="text-xs px-4 py-2"
          >
            <TrendingUp className="w-4 h-4 mr-1.5" />
            African Tech Trend Ingestion ({trends.length})
          </Button>
        </div>

        {/* TAB 1: STUDIO */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Input controls & trend shelf */}
            <div className="space-y-6">
              {/* Trend Pill Ingestion */}
              <Card glowColor="green" className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" /> Ingested Trends
                  </span>
                  <span className="text-2xs text-slate-500">Click to autofill</span>
                </div>

                <div className="space-y-2">
                  {trends.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleSelectTrend(t)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-emerald-500/30 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-2xs text-emerald-400 font-semibold">{t.category}</span>
                        <span className="text-2xs text-slate-500">Score: {t.growthScore}</span>
                      </div>
                      <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2">
                        {t.topic}
                      </p>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Keyword & Target Config */}
              <Card className="p-5 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">SEO Parameters</h3>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Article Target Title</label>
                  <input
                    type="text"
                    value={draftTitle}
                    onChange={e => setDraftTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Target Keywords (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={keywords}
                    onChange={e => setKeywords(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-emerald-500"
                  />
                </div>

                <Button
                  variant="glow-emerald"
                  onClick={generateDraft}
                  disabled={generating || !draftTitle.trim()}
                  className="w-full justify-center text-xs py-2.5"
                >
                  <Sparkles className={`w-4 h-4 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
                  {generating ? 'Drafting with CircuitSoul AI...' : 'Generate Full Technical Draft'}
                </Button>
              </Card>
            </div>

            {/* Right: Draft Editor & Preview */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="p-5 flex flex-col h-full justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b border-white/5">
                    <div>
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-emerald-400" />
                        Article Staging Canvas
                      </h2>
                      <div className="flex items-center gap-3 text-2xs text-slate-400 mt-0.5">
                        <span>{wordCount} words</span>
                        <span>•</span>
                        <span>~{readingTime} min read</span>
                        <span>•</span>
                        <span className="text-emerald-400">SEO Optimized (NDPR / Africa)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={previewMode ? 'glow-emerald' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewMode(!previewMode)}
                        className="text-xs"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        {previewMode ? 'Edit Raw' : 'Preview Format'}
                      </Button>
                    </div>
                  </div>

                  {draftContent ? (
                    previewMode ? (
                      <div className="p-5 bg-slate-900/60 border border-white/5 rounded-xl max-h-[500px] overflow-y-auto prose prose-invert prose-emerald max-w-none text-xs text-slate-300 leading-relaxed space-y-3">
                        <div className="whitespace-pre-wrap">{draftContent}</div>
                      </div>
                    ) : (
                      <textarea
                        value={draftContent}
                        onChange={e => setDraftContent(e.target.value)}
                        rows={16}
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 outline-none focus:border-emerald-500 leading-relaxed resize-none"
                        placeholder="Generated draft will populate here..."
                      />
                    )
                  ) : (
                    <div className="py-20 border border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-slate-900/20">
                      <Sparkles className="w-10 h-10 text-slate-600 mb-3 animate-pulse" />
                      <h4 className="text-sm font-bold text-white mb-1">Canvas is Empty</h4>
                      <p className="text-xs text-slate-400 max-w-md mb-4">
                        Pick a trending topic on the left or enter a custom title, then click &quot;Generate Full Technical Draft&quot; to compose an article.
                      </p>
                      <Button variant="outline" size="sm" onClick={generateDraft} className="text-xs">
                        Generate Sample Article
                      </Button>
                    </div>
                  )}
                </div>

                {/* Footer Publishing Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-white/5 mt-4">
                  <div className="flex items-center gap-2 text-2xs text-slate-400">
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    Target Engine: <strong className="text-slate-300">Ghost Admin API</strong>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={publishing || !draftContent.trim()}
                      onClick={() => publishToGhost('draft')}
                      className="text-xs flex-1 sm:flex-initial"
                    >
                      Save as Draft in Ghost
                    </Button>
                    <Button
                      variant="glow-emerald"
                      size="sm"
                      disabled={publishing || !draftContent.trim()}
                      onClick={() => publishToGhost('published')}
                      className="text-xs flex-1 sm:flex-initial"
                    >
                      <Send className={`w-3.5 h-3.5 mr-1.5 ${publishing ? 'animate-spin' : ''}`} />
                      {publishing ? 'Publishing...' : 'Publish Live to Ghost'}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: POSTS FEED */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Ghost Published Articles</h2>
                <p className="text-slate-400 text-xs">
                  Articles synchronized directly with your Ghost CMS database and content API.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchInitialData} className="text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh Posts
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {posts.map(post => (
                <Card key={post.id} glowColor="green" className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-2xs font-bold uppercase tracking-wider ${
                          post.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {post.status}
                      </span>
                      <span className="text-2xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {post.reading_time || 4} min read
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2 leading-snug">{post.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4 line-clamp-3">
                      {post.excerpt || post.html.replace(/<[^>]*>/g, '').substring(0, 160)}
                    </p>

                    {post.tags && post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {post.tags.map(t => (
                          <span
                            key={t.id}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-2xs text-slate-400 flex items-center gap-1"
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-400" />
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/5 text-2xs text-slate-400">
                    <span>
                      {post.published_at
                        ? `Published ${new Date(post.published_at).toLocaleDateString()}`
                        : 'Draft'}
                    </span>
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      View on Ghost <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TRENDS INGESTION */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">African Tech Trend Feed</h2>
              <p className="text-slate-400 text-xs">
                Real-time regional search telemetry, regulatory notices, and emerging market technical topics.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trends.map(t => (
                <Card key={t.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="px-2 py-0.5 rounded text-2xs font-bold uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        {t.category}
                      </span>
                      <span className="text-2xs text-amber-400 font-bold flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Momentum: {t.growthScore}/100
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-2">{t.topic}</h3>
                    <p className="text-xs text-slate-400 mb-4">
                      Source: <span className="text-slate-300">{t.source}</span>
                    </p>

                    <div className="space-y-1.5 mb-4">
                      <span className="text-2xs uppercase text-slate-500 font-bold">Suggested SEO Keywords</span>
                      <div className="flex flex-wrap gap-1.5">
                        {t.suggestedKeywords.map(k => (
                          <span
                            key={k}
                            className="px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-2xs text-slate-300"
                          >
                            #{k}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex justify-end">
                    <Button
                      variant="glow-emerald"
                      size="sm"
                      onClick={() => handleSelectTrend(t)}
                      className="text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" />
                      Generate Article from Trend
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
