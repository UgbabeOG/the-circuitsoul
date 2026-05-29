import axios from 'axios';
import { mockGhost } from './mocks/ghost.mock';

export class GhostAdapter {
  private isMock: boolean;
  private baseUrl: string;

  constructor(isMock: boolean) {
    this.isMock = isMock;
    this.baseUrl = process.env.GHOST_API_URL || 'http://localhost:2368/ghost/api/v4/admin';
  }

  async createPost(post: { title: string; html: string; status?: 'draft' | 'published' }) {
    if (this.isMock) {
      return mockGhost.createPost(post);
    }
    const token = this.generateToken();
    const response = await axios.post(`${this.baseUrl}/posts/`, { posts: [post] }, {
      headers: {
        Authorization: `Ghost ${token}`
      }
    });
    return response.data;
  }

  async getPosts() {
    if (this.isMock) {
      return mockGhost.getPosts();
    }
    const token = this.generateToken();
    const response = await axios.get(`${this.baseUrl}/posts/`, {
      headers: {
        Authorization: `Ghost ${token}`
      }
    });
    return response.data.posts;
  }

  private generateToken() {
    return 'mock_ghost_admin_token';
  }
}
