import axios from 'axios';
import * as crypto from 'crypto';
import { mockGhost, GhostPost, AfricanTechTrend } from './mocks/ghost.mock';

export class GhostAdapter {
  private isMock: boolean;
  private baseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.GHOST_API_URL || 'http://localhost:2368/ghost/api/admin';
  }

  getTrends(): AfricanTechTrend[] {
    return mockGhost.getTrends();
  }

  async getPosts(): Promise<GhostPost[]> {
    if (this.isMock) {
      return mockGhost.getPosts();
    }
    try {
      const token = this.generateToken();
      const response = await axios.get(`${this.baseUrl}/posts/`, {
        headers: {
          Authorization: `Ghost ${token}`,
          'Accept-Version': 'v5.0'
        },
        params: { limit: 30, include: 'tags,authors' }
      });
      return response.data?.posts || [];
    } catch (err: any) {
      console.warn('[GhostAdapter] Failed to query live Ghost API, falling back to mock:', err.message);
      return mockGhost.getPosts();
    }
  }

  async getPost(id: string): Promise<GhostPost | null> {
    if (this.isMock) {
      return mockGhost.getPost(id);
    }
    try {
      const token = this.generateToken();
      const response = await axios.get(`${this.baseUrl}/posts/${id}/`, {
        headers: {
          Authorization: `Ghost ${token}`,
          'Accept-Version': 'v5.0'
        }
      });
      return response.data?.posts?.[0] || null;
    } catch (err: any) {
      console.warn(`[GhostAdapter] Failed to get post ${id}, falling back to mock:`, err.message);
      return mockGhost.getPost(id);
    }
  }

  async createPost(post: {
    title: string;
    html: string;
    excerpt?: string;
    status?: 'draft' | 'published' | 'scheduled';
    tags?: string[];
    feature_image?: string;
  }): Promise<GhostPost> {
    if (this.isMock) {
      return mockGhost.createPost(post);
    }
    try {
      const token = this.generateToken();
      const payload = {
        posts: [
          {
            title: post.title,
            html: post.html,
            custom_excerpt: post.excerpt,
            status: post.status || 'draft',
            feature_image: post.feature_image,
            tags: post.tags?.map(name => ({ name })) || []
          }
        ]
      };

      const response = await axios.post(`${this.baseUrl}/posts/`, payload, {
        headers: {
          Authorization: `Ghost ${token}`,
          'Accept-Version': 'v5.0',
          'Content-Type': 'application/json'
        }
      });
      return response.data?.posts?.[0];
    } catch (err: any) {
      console.warn('[GhostAdapter] Failed to create post on live Ghost API, falling back to mock:', err.message);
      return mockGhost.createPost(post);
    }
  }

  async updatePost(id: string, updates: Partial<GhostPost>): Promise<GhostPost | null> {
    if (this.isMock) {
      return mockGhost.updatePost(id, updates);
    }
    try {
      const token = this.generateToken();
      const response = await axios.put(
        `${this.baseUrl}/posts/${id}/`,
        { posts: [updates] },
        {
          headers: {
            Authorization: `Ghost ${token}`,
            'Accept-Version': 'v5.0'
          }
        }
      );
      return response.data?.posts?.[0] || null;
    } catch (err: any) {
      console.warn(`[GhostAdapter] Failed to update post ${id}, falling back to mock:`, err.message);
      return mockGhost.updatePost(id, updates);
    }
  }

  /**
   * Generates a Ghost Admin API JWT token according to Ghost specification:
   * Key format: {id}:{secret}
   * Signed with HMAC-SHA256 using hex-decoded secret
   */
  private generateToken(): string {
    const key = process.env.GHOST_ADMIN_API_KEY;
    if (!key || !key.includes(':')) {
      return 'mock_ghost_admin_token';
    }

    try {
      const [id, secret] = key.split(':');
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: id })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + 300, aud: '/admin/' })).toString('base64url');
      
      const signature = crypto
        .createHmac('sha256', Buffer.from(secret, 'hex'))
        .update(`${header}.${payload}`)
        .digest('base64url');

      return `${header}.${payload}.${signature}`;
    } catch {
      return 'mock_ghost_admin_token';
    }
  }
}
