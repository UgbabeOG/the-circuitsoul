import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { Role, prisma } from '@circuitsoul/db';
import { parseSession, verifyProviderToken, verifySessionToken } from '@circuitsoul/auth';
import { GET as callbackGet, POST as callbackPost } from './callback/route.ts';
import { POST as logout } from './logout/route.ts';
import { POST as refresh } from './refresh/route.ts';
import { POST as signin } from './signin/route.ts';

const issuer = 'https://issuer.example.test';
const audience = 'circuitsoul-api';

function createProviderToken(
  privateKey: crypto.KeyObject,
  claims: Record<string, unknown>,
  kid = 'auth-test-key'
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const input = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(input).sign(privateKey).toString('base64url');
  return `${input}.${signature}`;
}

function stateCookie(response: Response): string {
  const value = response.headers.get('set-cookie')?.match(/circuitsoul_auth_state=([^;]+)/)?.[1];
  assert.ok(value, 'sign-in response should set an HttpOnly state cookie');
  return value;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: issuer,
    aud: audience,
    sub: 'provider-subject-1',
    org_id: 'org-1',
    email: 'member@example.com',
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides
  };
}

test('Clerk verifier enforces signature, expiry, issuer, audience, and verified email', async () => {
  const previous = {
    provider: process.env.AUTH_PROVIDER,
    issuer: process.env.CLERK_ISSUER_URL,
    audience: process.env.CLERK_AUDIENCE,
    jwks: process.env.CLERK_JWKS_URL,
    fetch: globalThis.fetch
  };
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const otherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  const jwk = publicKey.export({ format: 'jwk' });
  try {
    process.env.AUTH_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER_URL = issuer;
    process.env.CLERK_AUDIENCE = audience;
    process.env.CLERK_JWKS_URL = 'https://issuer.example.test/.well-known/jwks.json';
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'auth-test-key', use: 'sig' }] }));

    const valid = await verifyProviderToken(createProviderToken(privateKey, validClaims()));
    assert.deepEqual(valid, {
      subject: 'provider-subject-1',
      email: 'member@example.com',
      name: undefined,
      orgId: 'org-1'
    });

    assert.equal(await verifyProviderToken(createProviderToken(privateKey, validClaims({ exp: 1 }))), null);
    assert.equal(await verifyProviderToken(createProviderToken(privateKey, validClaims({ iss: 'https://wrong.example' }))), null);
    assert.equal(await verifyProviderToken(createProviderToken(privateKey, validClaims({ aud: 'wrong-audience' }))), null);
    assert.equal(await verifyProviderToken(createProviderToken(privateKey, validClaims({ email_verified: false }))), null);
    assert.equal(await verifyProviderToken(createProviderToken(otherKey, validClaims())), null);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.provider === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = previous.provider;
    if (previous.issuer === undefined) delete process.env.CLERK_ISSUER_URL;
    else process.env.CLERK_ISSUER_URL = previous.issuer;
    if (previous.audience === undefined) delete process.env.CLERK_AUDIENCE;
    else process.env.CLERK_AUDIENCE = previous.audience;
    if (previous.jwks === undefined) delete process.env.CLERK_JWKS_URL;
    else process.env.CLERK_JWKS_URL = previous.jwks;
  }
});

test('Clerk callback links verified identity, issues internal session, and allows bearer/cookie access', async () => {
  const previous = {
    provider: process.env.AUTH_PROVIDER,
    issuer: process.env.CLERK_ISSUER_URL,
    audience: process.env.CLERK_AUDIENCE,
    jwks: process.env.CLERK_JWKS_URL,
    secret: process.env.CIRCUITSOUL_AUTH_SECRET,
    fetch: globalThis.fetch
  };
  const originalUserFindUnique = prisma.user.findUnique;
  const originalIdentityFindUnique = prisma.providerIdentity.findUnique;
  const originalIdentityCreate = prisma.providerIdentity.create;
  const originalMembershipFindUnique = prisma.membership.findUnique;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  const linkedUser = { id: 'db-user-1', email: 'member@example.com', name: 'DB Member' };

  try {
    process.env.AUTH_PROVIDER = 'clerk';
    process.env.CLERK_ISSUER_URL = issuer;
    process.env.CLERK_AUDIENCE = audience;
    process.env.CLERK_JWKS_URL = 'https://issuer.example.test/.well-known/jwks.json';
    process.env.CIRCUITSOUL_AUTH_SECRET = 'test-secret-with-more-than-thirty-two-characters';
    globalThis.fetch = async () => new Response(JSON.stringify({ keys: [{ ...jwk, kid: 'auth-callback-key', use: 'sig' }] }));
    prisma.user.findUnique = (async () => linkedUser) as typeof prisma.user.findUnique;
    prisma.providerIdentity.findUnique = (async () => null) as typeof prisma.providerIdentity.findUnique;
    prisma.providerIdentity.create = (async () => ({
      id: 'identity-1',
      provider: 'CLERK',
      providerSubject: 'provider-subject-1',
      emailAtLink: linkedUser.email,
      userId: linkedUser.id,
      user: linkedUser
    })) as typeof prisma.providerIdentity.create;
    prisma.membership.findUnique = (async () => ({
      id: 'membership-1',
      userId: linkedUser.id,
      organizationId: 'org-1',
      role: Role.MEMBER,
      organization: { id: 'org-1', name: 'Organization', slug: 'organization' }
    })) as typeof prisma.membership.findUnique;

    const signInResponse = await signin(new Request('https://app.example.test/api/auth/signin', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'clerk' })
    }));
    const state = (await signInResponse.json()).state as string;
    const stateCookieValue = stateCookie(signInResponse);
    const providerToken = createProviderToken(privateKey, validClaims(), 'auth-callback-key');

    const response = await callbackPost(new Request('https://app.example.test/api/auth/callback', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `circuitsoul_auth_state=${stateCookieValue}`
      },
      body: JSON.stringify({ state, token: providerToken })
    }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
    const responseBody = await response.json();
    assert.equal(responseBody.user.id, linkedUser.id);
    assert.equal('token' in responseBody, false, 'internal token is not exposed in response JSON');

    const sessionToken = response.headers.get('set-cookie')?.match(/circuitsoul_session=([^;]+)/)?.[1];
    assert.ok(sessionToken);
    const cookieSession = parseSession({ cookie: `circuitsoul_session=${sessionToken}` });
    const bearerSession = parseSession({ authorization: `Bearer ${sessionToken}` });
    assert.equal(cookieSession?.userId, linkedUser.id);
    assert.equal(bearerSession?.orgId, 'org-1');
    assert.equal(verifySessionToken(sessionToken!)?.role, Role.MEMBER);
    assert.equal(parseSession({ authorization: `Bearer ${providerToken}` }), null);
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.providerIdentity.findUnique = originalIdentityFindUnique;
    prisma.providerIdentity.create = originalIdentityCreate;
    prisma.membership.findUnique = originalMembershipFindUnique;
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [
      ['AUTH_PROVIDER', previous.provider],
      ['CLERK_ISSUER_URL', previous.issuer],
      ['CLERK_AUDIENCE', previous.audience],
      ['CLERK_JWKS_URL', previous.jwks],
      ['CIRCUITSOUL_AUTH_SECRET', previous.secret]
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('callback rejects missing or mismatched state and legacy GET token callbacks', async () => {
  const stateResponse = await callbackPost(new Request('https://app.example.test/api/auth/callback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ state: 'attacker-state', token: 'untrusted' })
  }));
  assert.equal(stateResponse.status, 401);
  const legacyResponse = await callbackGet();
  assert.equal(legacyResponse.status, 405);
});

test('refresh and logout revoke internal sessions and clear the cookie', async () => {
  const previousSecret = process.env.CIRCUITSOUL_AUTH_SECRET;
  const originalMembershipFindUnique = prisma.membership.findUnique;
  const originalRevokedFindUnique = prisma.revokedSession.findUnique;
  const originalRevokedUpsert = prisma.revokedSession.upsert;
  const token = (await import('@circuitsoul/auth')).signSessionToken({
    userId: 'user-lifecycle',
    email: 'member@example.com',
    orgId: 'org-lifecycle',
    role: Role.MEMBER
  });
  try {
    prisma.membership.findUnique = (async () => ({ role: Role.ADMIN })) as typeof prisma.membership.findUnique;
    prisma.revokedSession.findUnique = (async () => null) as typeof prisma.revokedSession.findUnique;
    prisma.revokedSession.upsert = (async () => ({})) as typeof prisma.revokedSession.upsert;

    const refreshed = await refresh(new Request('https://app.example.test/api/auth/refresh', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` }
    }));
    assert.equal(refreshed.status, 200);
    assert.equal('token' in await refreshed.clone().json(), false, 'refreshed token stays in HttpOnly cookie');
    const refreshedToken = refreshed.headers.get('set-cookie')?.match(/circuitsoul_session=([^;]+)/)?.[1];
    assert.ok(refreshedToken);
    assert.equal(verifySessionToken(refreshedToken!)?.role, Role.ADMIN);

    const logoutResponse = await logout(new Request('https://app.example.test/api/auth/logout', {
      method: 'POST',
      headers: { cookie: `circuitsoul_session=${refreshedToken}` }
    }));
    assert.equal(logoutResponse.status, 200);
    assert.match(logoutResponse.headers.get('set-cookie') || '', /Max-Age=0/i);
  } finally {
    prisma.membership.findUnique = originalMembershipFindUnique;
    prisma.revokedSession.findUnique = originalRevokedFindUnique;
    prisma.revokedSession.upsert = originalRevokedUpsert;
    if (previousSecret === undefined) delete process.env.CIRCUITSOUL_AUTH_SECRET;
    else process.env.CIRCUITSOUL_AUTH_SECRET = previousSecret;
  }
});
