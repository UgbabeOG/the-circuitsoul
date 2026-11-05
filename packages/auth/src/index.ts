import * as crypto from 'crypto';
import { Role } from '@circuitsoul/db';
import { prisma } from '@circuitsoul/db';

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export interface ProviderIdentity {
  subject: string;
  email: string;
  name?: string;
  orgId: string;
}

type ClerkJwk = JsonWebKey & { kid?: string; use?: string };
let clerkJwksCache: { keys: ClerkJwk[]; expiresAt: number } | undefined;

async function loadClerkJwks(refresh = false): Promise<ClerkJwk[]> {
  const configuredUrl = process.env.CLERK_JWKS_URL;
  if (!configuredUrl) throw new Error('CLERK_JWKS_URL is required');
  const jwksUrl = new URL(configuredUrl);
  if (jwksUrl.protocol !== 'https:' && process.env.NODE_ENV !== 'test') {
    throw new Error('CLERK_JWKS_URL must use HTTPS');
  }
  if (!refresh && clerkJwksCache && clerkJwksCache.expiresAt > Date.now()) {
    return clerkJwksCache.keys;
  }

  const response = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Clerk JWKS request failed (${response.status})`);
  const result = await response.json() as { keys?: ClerkJwk[] };
  if (!Array.isArray(result.keys) || result.keys.length === 0) {
    throw new Error('Clerk JWKS response contains no keys');
  }
  clerkJwksCache = { keys: result.keys, expiresAt: Date.now() + 5 * 60 * 1000 };
  return result.keys;
}

export async function verifyProviderToken(token: string): Promise<ProviderIdentity | null> {
  const issuer = process.env.CLERK_ISSUER_URL;
  const audience = process.env.CLERK_AUDIENCE;
  if (
    !token ||
    (process.env.AUTH_PROVIDER || 'custom').toLowerCase() !== 'clerk' ||
    !issuer ||
    !audience
  ) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerPart, payloadPart, signaturePart] = parts;
    const header = JSON.parse(fromBase64Url(headerPart)) as { alg?: string; kid?: string };
    if (header.alg !== 'RS256' || !header.kid) return null;

    let keys = await loadClerkJwks();
    let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use !== 'enc');
    if (!jwk) {
      keys = await loadClerkJwks(true);
      jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA' && key.use !== 'enc');
    }
    if (!jwk) return null;

    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(`${headerPart}.${payloadPart}`);
    verifier.end();
    if (!verifier.verify(crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(signaturePart, 'base64url'))) {
      return null;
    }

    const claims = JSON.parse(fromBase64Url(payloadPart)) as Record<string, unknown>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof claims.exp !== 'number' || claims.exp <= now ||
      typeof claims.iss !== 'string' || claims.iss !== issuer ||
      (typeof claims.nbf === 'number' && claims.nbf > now)
    ) return null;

    const audiences = Array.isArray(claims.aud)
      ? claims.aud.filter((value): value is string => typeof value === 'string')
      : typeof claims.aud === 'string' ? [claims.aud] : [];
    if (!audiences.includes(audience)) return null;

    const subject = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    const orgId = typeof claims.org_id === 'string' ? claims.org_id : '';
    if (!subject || !email || claims.email_verified !== true || !orgId) return null;

    return {
      subject,
      email,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      orgId
    };
  } catch {
    return null;
  }
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
  if (!token || token.split('.').length !== 2) return null;

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

    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Partial<UserSession>;
    const now = Math.floor(Date.now() / 1000);
    if (
      typeof session.userId !== 'string' || !session.userId ||
      typeof session.email !== 'string' || !session.email ||
      typeof session.orgId !== 'string' || !session.orgId ||
      !Object.values(Role).includes(session.role as Role) ||
      typeof session.iat !== 'number' || typeof session.exp !== 'number' ||
      session.iat > now || session.exp <= now || session.exp <= session.iat
    ) {
      return null;
    }

    return session as UserSession;
  } catch {
    return null;
  }
}

/**
 * Parses user session from request headers and cookies.
 * Strictly verifies signatures. In production, never falls back to mock sessions.
 * Only internal HMAC sessions authorize app requests. External provider
 * credentials are exchanged for an internal session at the auth callback.
 */
export function parseSession(headers: Record<string, string | undefined>): UserSession | null {
  // 1. Check Authorization Bearer token
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const verified = verifySessionToken(token);
    if (verified) return verified;
  }

  // 2. Check Cookie: circuitsoul_session
  const cookieHeader = headers['cookie'] || headers['Cookie'];
  if (cookieHeader) {
    const match = cookieHeader.match(/circuitsoul_session=([^;]+)/);
    if (match && match[1]) {
      try {
        const verified = verifySessionToken(decodeURIComponent(match[1]));
        if (verified) return verified;
      } catch {
        return null;
      }
    }
  }

  // 3. Check signed custom session header
  // 4. Explicit dev override only when intentionally enabled in development.
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_SESSION === 'true') {
    return {
      userId: 'user-dev-uuid-001',
      email: 'dev@circuitsoul.com',
      name: 'Developer Admin (SME Owner)',
      orgId: 'org-dev-uuid-100',
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

export function getSessionToken(headers: Record<string, string | undefined>): string | null {
  const authHeader = headers['authorization'] || headers['Authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (verifySessionToken(token)) return token;
  }

  const cookieHeader = headers['cookie'] || headers['Cookie'];
  const match = cookieHeader?.match(/circuitsoul_session=([^;]+)/);
  if (match?.[1]) {
    try {
      const token = decodeURIComponent(match[1]);
      if (verifySessionToken(token)) return token;
    } catch {
      return null;
    }
  }

  return null;
}

export async function requireActiveSession(
  headers: Record<string, string | undefined>
): Promise<UserSession> {
  const session = requireSession(headers);
  const token = getSessionToken(headers);
  if (token && await isSessionRevoked(token)) {
    throw new Error('Unauthorized: session has been revoked');
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

  await prisma.revokedSession.upsert({
    where: { tokenHash },
    update: {},
    create: {
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

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.userId,
        organizationId: session.orgId
      }
    },
    select: { role: true }
  });
  if (!membership) return null;

  // Revoke the old token
  await revokeSession(token);

  // Issue a new token with current membership privileges and extended expiry
  return signSessionToken(
    {
      userId: session.userId,
      email: session.email,
      name: session.name,
      orgId: session.orgId,
      role: membership.role
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
  const session = await requireActiveSession(headers);
  const role = await verifyOrgMembership(session.userId, session.orgId);
  return { session: { ...session, role }, role };
}

export async function requireAuthenticatedPermission(
  headers: Record<string, string | undefined>,
  permission: Permission
): Promise<UserSession> {
  const { session } = await requireAuthenticatedOrg(headers);
  return requirePermission(session, permission);
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
