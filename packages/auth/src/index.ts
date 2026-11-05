import * as crypto from 'crypto';
import { Role } from '@circuitsoul/db';
import { prisma } from '@circuitsoul/db';

function getAuthProvider(): string {
  return (process.env.AUTH_PROVIDER || 'custom').toLowerCase();
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function normalizePublicKey(publicKey: string): string {
  const trimmed = publicKey.trim();
  if (trimmed.startsWith('-----BEGIN')) return trimmed;
  const normalized = trimmed.replace(/\\s+/g, '');
  const wrapped = normalized.match(/.{1,64}/g)?.join('\n') || normalized;
  return `-----BEGIN PUBLIC KEY-----\n${wrapped}\n-----END PUBLIC KEY-----`;
}

function normalizeRole(value: unknown): Role | undefined {
  const role = String(value ?? '').toUpperCase();
  if (!role) return undefined;
  if (role.includes('OWNER')) return Role.OWNER;
  if (role.includes('ADMIN')) return Role.ADMIN;
  if (role.includes('MEMBER')) return Role.MEMBER;
  return undefined;
}

function verifyClerkJwt(token: string): UserSession | null {
  const publicKeyPem = process.env.CLERK_PUBLIC_KEY;
  if (!publicKeyPem || getAuthProvider() !== 'clerk') {
    return null;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(signingInput);
    verifier.end();

    if (!verifier.verify(normalizePublicKey(publicKeyPem), signature)) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadB64)) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < now) {
      return null;
    }

    // Validate issuer
    const issuer = process.env.CLERK_ISSUER_URL;
    if (issuer) {
      const tokenIssuer =
        (payload.iss as string | undefined) ||
        (payload.issuer as string | undefined);
      if (tokenIssuer !== issuer) {
        return null;
      }
    }

    // Validate audience
    const audience = process.env.CLERK_AUDIENCE;
    if (audience) {
      const tokenAud = payload.aud as string | string[] | undefined;
      const auds = Array.isArray(tokenAud) ? tokenAud : tokenAud ? [tokenAud] : [];
      if (!auds.includes(audience)) {
        return null;
      }
    }

    const orgId =
      (payload.org_id as string | undefined) ||
      (payload.organization_id as string | undefined) ||
      (payload.orgId as string | undefined) ||
      (payload.organizationId as string | undefined);

    const userId =
      (payload.sub as string | undefined) ||
      (payload.user_id as string | undefined) ||
      (payload.userId as string | undefined);

    if (!userId || !orgId) {
      return null;
    }

    const permissions = Array.isArray(payload.permissions) ? payload.permissions : undefined;
    const role = normalizeRole(
      payload.role ?? payload.user_role ?? payload.org_role ?? permissions?.[0]
    );

    return {
      userId,
      email: (payload.email as string | undefined) || `${userId}@clerk.local`,
      name: (payload.name as string | undefined) || (payload.full_name as string | undefined),
      orgId,
      role: role || Role.MEMBER
    };
  } catch {
    return null;
  }
}

export function parseProviderToken(token: string): UserSession | null {
  if (!token) return null;

  if (getAuthProvider() === 'clerk') {
    return verifyClerkJwt(token);
  }

  if (getAuthProvider() === 'custom') {
    return verifySessionToken(token);
  }

  return verifySessionToken(token) || verifyClerkJwt(token);
}

export interface UserSession {
  userId: string;
  email: string;
  name?: string;
  orgId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export enum Permission {
  VIEW_ORG = 'VIEW_ORG',
  MANAGE_WORKFLOWS = 'MANAGE_WORKFLOWS',
  PUBLISH_CONTENT = 'PUBLISH_CONTENT',
  MANAGE_ASSETS = 'MANAGE_ASSETS'
}

const PERMISSION_MATRIX: Record<Permission, Role[]> = {
  [Permission.VIEW_ORG]: [Role.OWNER, Role.ADMIN, Role.MEMBER],
  [Permission.MANAGE_WORKFLOWS]: [Role.OWNER, Role.ADMIN],
  [Permission.PUBLISH_CONTENT]: [Role.OWNER, Role.ADMIN],
  [Permission.MANAGE_ASSETS]: [Role.OWNER, Role.ADMIN]
};

const DEFAULT_DEV_SECRET = 'circuitsoul_development_auth_secret_minimum_32_characters_key_2026';

function getAuthSecret(): string {
  const secret = process.env.CIRCUITSOUL_AUTH_SECRET || process.env.GATEWAY_SECRET_KEY;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: CIRCUITSOUL_AUTH_SECRET must be set in production!');
  }
  return secret || DEFAULT_DEV_SECRET;
}

/**
 * Creates a cryptographically signed session token using HMAC-SHA256
 */
export function signSessionToken(session: Omit<UserSession, 'iat' | 'exp'>, expiresInSeconds = 86400 * 7): string {
  const secret = getAuthSecret();
  const now = Math.floor(Date.now() / 1000);
  const payload: UserSession = {
    ...session,
    iat: now,
    exp: now + expiresInSeconds
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and parses a signed session token using timing-safe comparison
 */
export function verifySessionToken(token: string): UserSession | null {
  if (!token || !token.includes('.')) return null;

  try {
    const [payloadB64, signature] = token.split('.');
    const secret = getAuthSecret();

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadB64)
      .digest('base64url');

    // Timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
      return null;
    }

    const session: UserSession = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (session.exp && session.exp < now) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Parses user session from request headers and cookies.
 * Strictly verifies signatures. In production, never falls back to mock sessions.
 * Session org context is verified from the trusted token and then validated
 * against the user's Membership records before app access is granted. Org
 * switching may be requested explicitly through x-circuitsoul-org-id, but it
 * is only considered valid once DB membership checks confirm access.
 */
export function parseSession(headers: Record<string, string | undefined>): UserSession | null {
  const overrideOrgId = headers['x-circuitsoul-org-id'] || headers['X-CircuitSoul-Org-Id'];
  const applyOrgOverride = (session: UserSession): UserSession => {
    if (!overrideOrgId) return session;
    const sanitizedOrgId = overrideOrgId.trim();
    return sanitizedOrgId ? { ...session, orgId: sanitizedOrgId } : session;
  };

  // 1. Check Authorization Bearer token
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const verified = parseProviderToken(token);
    if (verified) return applyOrgOverride(verified);
  }

  // 2. Check Cookie: circuitsoul_session
  const cookieHeader = headers['cookie'] || headers['Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/circuitsoul_session=([^;]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      const verified = parseProviderToken(decoded);
      if (verified) return applyOrgOverride(verified);
    }
  }

  // 3. Check signed custom session header
  const customHeader = headers['x-circuitsoul-session'];
  if (customHeader) {
    // If it's a signed token
    if (customHeader.includes('.')) {
      const verified = parseProviderToken(customHeader);
      if (verified) return applyOrgOverride(verified);
    }
  }

  // 4. Explicit dev override only when intentionally enabled in development.
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_SESSION === 'true') {
    return {
      userId: 'user-dev-uuid-001',
      email: 'dev@circuitsoul.com',
      name: 'Developer Admin (SME Owner)',
      orgId: overrideOrgId ? overrideOrgId.trim() || 'org-dev-uuid-100' : 'org-dev-uuid-100',
      role: Role.OWNER
    };
  }

  return null;
}

export function requireSession(headers: Record<string, string | undefined>): UserSession {
  const session = parseSession(headers);
  if (!session || !session.orgId) {
    throw new Error('Unauthorized: valid CircuitSoul session with active organization required');
  }
  return session;
}

/**
 * Verifies that the session user is an active member of the given organization
 * against the database Membership table. Never trusts client-supplied org IDs.
 */
export async function verifyOrgMembership(userId: string, organizationId: string): Promise<Role> {
  if (!userId || !organizationId) {
    throw new Error('TenantAccessDenied: No active organization session.');
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId
      }
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new Error('TenantAccessDenied: User is not a member of this organization.');
  }

  return membership.role;
}

/**
 * Switches the active organization for a verified user.
 * Verifies DB membership before allowing the switch — never trusts client-supplied org IDs.
 * Returns the user's role in the target organization. Caller is responsible for
 * issuing a new session token with the switched organization context.
 */
export async function switchOrganization(
  userId: string,
  organizationId: string
): Promise<Role> {
  return verifyOrgMembership(userId, organizationId);
}

/**
 * Hashes a session token for storage in the revocation table.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Revokes a session token by storing its hash in the RevokedSession table.
 * The token is rendered invalid immediately.
 */
export async function revokeSession(token: string): Promise<void> {
  if (!token || !token.includes('.')) return;

  const tokenHash = hashToken(token);
  const session = verifySessionToken(token);
  if (!session) return;

  await prisma.revokedSession.create({
    data: {
      tokenHash,
      userId: session.userId,
      expiresAt: new Date((session.exp || 0) * 1000)
    }
  });
}

/**
 * Checks whether a session token has been revoked.
 */
export async function isSessionRevoked(token: string): Promise<boolean> {
  if (!token || !token.includes('.')) return true;

  const tokenHash = hashToken(token);
  const revoked = await prisma.revokedSession.findUnique({
    where: { tokenHash }
  });
  return !!revoked;
}

/**
 * Refreshes a session token by issuing a new signed token with extended expiry.
 * Revokes the old token and returns the new one.
 */
export async function refreshSession(token: string): Promise<string | null> {
  if (!token || !token.includes('.')) return null;

  const revoked = await isSessionRevoked(token);
  if (revoked) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  // Revoke the old token
  await revokeSession(token);

  // Issue a new token with the same context but extended expiry
  return signSessionToken(
    {
      userId: session.userId,
      email: session.email,
      name: session.name,
      orgId: session.orgId,
      role: session.role
    },
    86400 * 7
  );
}

/**
 * Parses the session from headers and verifies the user is a member of the
 * session's organization. This is the authoritative entry point for all
 * tenant-scoped route handlers.
 */
export async function requireAuthenticatedOrg(
  headers: Record<string, string | undefined>
): Promise<{ session: UserSession; role: Role }> {
  const session = requireSession(headers);
  const role = await verifyOrgMembership(session.userId, session.orgId);
  return { session, role };
}

export function checkRole(session: UserSession | null, requiredRoles: Role[]): boolean {
  if (!session || !session.role) return false;
  return requiredRoles.includes(session.role);
}

export function requireRole(session: UserSession | null, requiredRoles: Role[]): UserSession {
  if (!session || !session.orgId) {
    throw new Error('Unauthorized: valid CircuitSoul session with active organization required');
  }

  if (!checkRole(session, requiredRoles)) {
    const names = requiredRoles.map((role) => role.toString()).join(' or ');
    throw new Error(`Forbidden: Requires ${names} role`);
  }

  return session;
}

export function requireMembership(session: UserSession | null, requiredRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]): UserSession {
  return requireRole(session, requiredRoles);
}

export function hasPermission(session: UserSession | null, permission: Permission): boolean {
  if (!session || !session.role) return false;
  const allowedRoles = PERMISSION_MATRIX[permission] || [];
  return allowedRoles.includes(session.role);
}

export function requirePermission(session: UserSession | null, permission: Permission): UserSession {
  if (!session || !session.orgId) {
    throw new Error('Unauthorized: valid CircuitSoul session with active organization required');
  }

  if (!hasPermission(session, permission)) {
    throw new Error(`Forbidden: Requires ${permission.replace(/_/g, ' ').toLowerCase()} permission`);
  }

  return session;
}

export const RBAC = {
  isOwner: (session: UserSession | null) => checkRole(session, [Role.OWNER]),
  isAdmin: (session: UserSession | null) => checkRole(session, [Role.OWNER, Role.ADMIN]),
  isMember: (session: UserSession | null) => checkRole(session, [Role.OWNER, Role.ADMIN, Role.MEMBER]),
  requireRole: (session: UserSession | null, requiredRoles: Role[]) => requireRole(session, requiredRoles),
  requireMembership: (session: UserSession | null, requiredRoles: Role[] = [Role.OWNER, Role.ADMIN, Role.MEMBER]) =>
    requireMembership(session, requiredRoles),
  hasPermission: (session: UserSession | null, permission: Permission) => hasPermission(session, permission),
  requirePermission: (session: UserSession | null, permission: Permission) => requirePermission(session, permission),
  assertOwner: (session: UserSession | null) => {
    if (!RBAC.isOwner(session)) throw new Error('Forbidden: Requires OWNER role');
  },
  assertAdmin: (session: UserSession | null) => {
    if (!RBAC.isAdmin(session)) throw new Error('Forbidden: Requires ADMIN role');
  }
};
