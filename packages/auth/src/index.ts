import { Role } from '@circuitsoul/db';

export interface UserSession {
  userId: string;
  email: string;
  name?: string;
  orgId?: string;
  role?: Role;
}

export function parseSession(headers: Record<string, string>): UserSession | null {
  const mockSessionHeader = headers['x-circuitsoul-session'];
  if (mockSessionHeader) {
    try {
      return JSON.parse(mockSessionHeader);
    } catch {
      return null;
    }
  }

  // Fallback to mock session for development environment
  if (process.env.NODE_ENV !== 'production') {
    return {
      userId: 'user-dev-uuid-001',
      email: 'dev@circuitsoul.com',
      name: 'Developer Admin',
      orgId: 'org-dev-uuid-100',
      role: Role.OWNER
    };
  }

  return null;
}

export function checkRole(session: UserSession | null, requiredRoles: Role[]): boolean {
  if (!session || !session.role) return false;
  return requiredRoles.includes(session.role);
}

export const RBAC = {
  isOwner: (session: UserSession | null) => checkRole(session, [Role.OWNER]),
  isAdmin: (session: UserSession | null) => checkRole(session, [Role.OWNER, Role.ADMIN]),
  isMember: (session: UserSession | null) => checkRole(session, [Role.OWNER, Role.ADMIN, Role.MEMBER])
};
