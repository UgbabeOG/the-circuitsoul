export interface GhostPost {
  id: string;
  uuid?: string;
  title: string;
  slug: string;
  html: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'scheduled';
  url: string;
  feature_image?: string;
  tags?: Array<{ id: string; name: string; slug: string }>;
  published_at?: string;
  updated_at: string;
  created_at: string;
  reading_time?: number;
}

export interface AfricanTechTrend {
  id: string;
  topic: string;
  source: string;
  category: string;
  suggestedKeywords: string[];
  growthScore: number;
}

export const CURATED_AFRICAN_TECH_TRENDS: AfricanTechTrend[] = [
  {
    id: 'tr-01',
    topic: 'NDPR Data Sovereignty: Cloud Architectures for Nigerian SaaS in 2026',
    source: 'Nigeria Data Protection Commission (NDPC) Regulatory Bulletin',
    category: 'Regulatory Compliance',
    suggestedKeywords: ['NDPR compliance', 'Lagos data center', 'data sovereignty', 'AWS af-south-1', 'postgreSQL encryption'],
    growthScore: 94
  },
  {
    id: 'tr-02',
    topic: 'Multi-Rail Payment Failover: Integrating Paystack, Flutterwave, and Squad',
    source: 'African Fintech Infrastructure Index',
    category: 'Fintech Engineering',
    suggestedKeywords: ['payment failover', 'paystack webhook', 'flutterwave api', 'fintech reliability', 'latency optimization'],
    growthScore: 89
  },
  {
    id: 'tr-03',
    topic: 'Mitigating Egress Bandwidth Costs on Emerging Market Cloud Deployments',
    source: 'TechCabal Infrastructure Survey',
    category: 'CloudOps & DevOps',
    suggestedKeywords: ['cloud egress costs', 'CloudFront edge Lagos', 'Prometheus monitoring', 'AWS cost optimization'],
    growthScore: 86
  },
  {
    id: 'tr-04',
    topic: 'Zero-Trust Container Security with Wazuh SIEM for Distributed Engineering Teams',
    source: 'West Africa Cybersecurity Round Table',
    category: 'Cybersecurity',
    suggestedKeywords: ['Wazuh SIEM', 'container vulnerability', 'Docker hardening', 'CVE mitigation', 'SOC automation'],
    growthScore: 92
  }
];

let inMemoryPosts: GhostPost[] = [
  {
    id: 'g-001',
    uuid: 'uuid-g1',
    title: 'Securing Cloud Workloads in Africa: A Guide for SaaS Startups',
    slug: 'securing-cloud-workloads-africa',
    html: `
      <h2>The New Reality of African Cloud Infrastructure</h2>
      <p>As African startups scale beyond seed rounds into regional expansion, cloud security is no longer an afterthought. Regulators like the NDPC in Nigeria and the Data Protection Commissioner in Kenya are enforcing strict residency penalties.</p>
      <h3>Three Pillars of Sovereignty</h3>
      <ol>
        <li><strong>Data-at-Rest Sovereignty:</strong> Ensure primary databases sit in certified regional hosting zones.</li>
        <li><strong>Continuous SIEM Telemetry:</strong> Deploy lightweight Wazuh agents across all Kubernetes pods.</li>
        <li><strong>Automated Breach Remediation:</strong> Link alert hooks to n8n for sub-second quarantine.</li>
      </ol>
      <p>By coupling localized compliance with automated SIEM agents, startups can maintain 99.9% compliance scores without ballooning DevOps overhead.</p>
    `.trim(),
    excerpt: 'How venture-backed African startups can comply with NDPR regulations while maintaining rapid feature velocity.',
    status: 'published',
    url: 'https://circuitsoul.com/blog/securing-cloud-workloads-africa',
    feature_image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80',
    tags: [
      { id: 't1', name: 'Security', slug: 'security' },
      { id: 't2', name: 'NDPR', slug: 'ndpr' }
    ],
    published_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    reading_time: 4
  },
  {
    id: 'g-002',
    uuid: 'uuid-g2',
    title: 'Optimizing Multi-Region Infrastructure Costs in 2026',
    slug: 'optimizing-multi-region-costs',
    html: `
      <h2>Why African SaaS Egress Is So Expensive</h2>
      <p>Inter-region traffic between European regions (like Dublin or Frankfurt) and West African endpoints incurs high latency and bandwidth tolls. This article breaks down Prometheus metrics to identify compute waste.</p>
      <h3>Cost Control Checklist</h3>
      <ul>
        <li>Downscale idle staging databases after business hours.</li>
        <li>Terminate unattached EBS volumes automatically with scheduled workflows.</li>
        <li>Deploy local caching layers near Lagos and Nairobi IXPs.</li>
      </ul>
    `.trim(),
    excerpt: 'Tactics to reduce AWS and Azure cloud spend by up to 28% for African tech companies.',
    status: 'published',
    url: 'https://circuitsoul.com/blog/optimizing-multi-region-costs',
    feature_image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&q=80',
    tags: [
      { id: 't3', name: 'CloudOps', slug: 'cloudops' },
      { id: 't4', name: 'Cost Optimization', slug: 'cost-optimization' }
    ],
    published_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    reading_time: 5
  }
];

export const mockGhost = {
  getTrends(): AfricanTechTrend[] {
    return CURATED_AFRICAN_TECH_TRENDS;
  },

  async getPosts(): Promise<GhostPost[]> {
    return [...inMemoryPosts];
  },

  async getPost(idOrSlug: string): Promise<GhostPost | null> {
    const post = inMemoryPosts.find(p => p.id === idOrSlug || p.slug === idOrSlug);
    return post || null;
  },

  async createPost(post: {
    title: string;
    html: string;
    excerpt?: string;
    status?: 'draft' | 'published' | 'scheduled';
    tags?: string[];
    feature_image?: string;
  }): Promise<GhostPost> {
    const slug = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const wordCount = post.html.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const newPost: GhostPost = {
      id: `g-${Math.random().toString(36).substring(2, 8)}`,
      uuid: `uuid-${Math.random().toString(36).substring(2, 10)}`,
      title: post.title,
      slug,
      html: post.html,
      excerpt: post.excerpt || post.html.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
      status: post.status || 'draft',
      url: `https://circuitsoul.com/blog/${slug}`,
      feature_image: post.feature_image || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&q=80',
      tags: (post.tags || ['Engineering', 'SaaS']).map((t, idx) => ({
        id: `t-${idx}`,
        name: t,
        slug: t.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      })),
      published_at: post.status === 'published' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      reading_time: readingTime
    };

    inMemoryPosts = [newPost, ...inMemoryPosts];
    return newPost;
  },

  async updatePost(id: string, updates: Partial<GhostPost>): Promise<GhostPost | null> {
    const idx = inMemoryPosts.findIndex(p => p.id === id);
    if (idx === -1) return null;

    inMemoryPosts[idx] = {
      ...inMemoryPosts[idx],
      ...updates,
      updated_at: new Date().toISOString()
    };
    return inMemoryPosts[idx];
  },

  async deletePost(id: string): Promise<boolean> {
    const initialLen = inMemoryPosts.length;
    inMemoryPosts = inMemoryPosts.filter(p => p.id !== id);
    return inMemoryPosts.length < initialLen;
  }
};
