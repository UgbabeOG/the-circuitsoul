interface GhostPost {
  id: string;
  title: string;
  html: string;
  status: string;
  url: string;
  published_at: string;
  updated_at: string;
}

const mockDb: GhostPost[] = [
  {
    id: "g1",
    title: "Securing Cloud Workloads in Africa: A Guide for SaaS Startups",
    html: "<p>Cloud workload security is becoming a core challenge for digital startups in Africa...</p>",
    status: "published",
    url: "https://circuitsoul.com/blog/securing-cloud-workloads-africa",
    published_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: "g2",
    title: "Optimizing Multi-Region Infrastructure Costs in 2026",
    html: "<p>Managing egress costs and database replication overhead in a multi-region deployment can be tricky...</p>",
    status: "published",
    url: "https://circuitsoul.com/blog/optimizing-multi-region-costs",
    published_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

export const mockGhost = {
  async createPost(post: { title: string; html: string; status?: 'draft' | 'published' }) {
    console.log(`[MOCK GHOST] Creating new blog post: ${post.title}`);
    const newPost: GhostPost = {
      id: "g" + Math.random().toString(36).substring(7),
      title: post.title,
      html: post.html,
      status: post.status || 'draft',
      url: `https://circuitsoul.com/blog/${post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDb.push(newPost);
    return newPost;
  },

  async getPosts() {
    console.log(`[MOCK GHOST] Getting all posts (Mock Mode)`);
    return [...mockDb];
  }
};
