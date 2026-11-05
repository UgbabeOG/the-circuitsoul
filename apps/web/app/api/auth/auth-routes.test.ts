import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import { Role, prisma } from '@circuitsoul/db';
import { verifySessionToken } from '@circuitsoul/auth';
import { GET as callback } from './callback/route.ts';
import { POST as signin } from './signin/route.ts';

test('custom email-only sign-in cannot create a session for an existing member', async () => {
  const originalFindUnique = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({
    id: 'existing-user',
    email: 'member@example.com',
    name: 'Existing Member'
  })) as typeof prisma.user.findUnique;

  try {
    const response = await signin(
      new Request('http://localhost/api/auth/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'member@example.com', provider: 'custom' })
      })
    );

    assert.equal(response.status, 501);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).success, false);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test('Clerk sign-in initiation does not append the supplied email to its callback URL', async () => {
  const originalSignInUrl = process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = '/clerk/sign-in';

  try {
    const response = await signin(
      new Request('http://localhost/api/auth/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'unverified@example.com', provider: 'clerk' })
      })
    );

    assert.equal(response.status, 200);
    assert.equal((await response.json()).signInUrl, '/clerk/sign-in');
  } finally {
    if (originalSignInUrl === undefined) delete process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL;
    else process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL = originalSignInUrl;
  }
});

test('callback email query cannot create a session for an existing member', async () => {
  const originalFindUnique = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({
    id: 'existing-user',
    email: 'member@example.com',
    name: 'Existing Member'
  })) as typeof prisma.user.findUnique;

  try {
    const response = await callback(
      new Request('http://localhost/api/auth/callback?email=member%40example.com')
    );

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal((await response.json()).success, false);
  } finally {
    prisma.user.findUnique = originalFindUnique;
  }
});

test('verified provider token mints a session only with DB-backed user and organization membership', async () => {
  const originalProvider = process.env.AUTH_PROVIDER;
  const originalClerkKey = process.env.CLERK_PUBLIC_KEY;
  const originalUserFindUnique = prisma.user.findUnique;
  const originalMembershipFindUnique = prisma.membership.findUnique;
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  try {
    process.env.AUTH_PROVIDER = 'clerk';
    process.env.CLERK_PUBLIC_KEY = publicKey;
    prisma.user.findUnique = (async () => ({
      id: 'db-user-1',
      email: 'member@example.com',
      name: 'DB Member'
    })) as typeof prisma.user.findUnique;
    prisma.membership.findUnique = (async () => ({
      id: 'membership-1',
      userId: 'db-user-1',
      organizationId: 'db-org-1',
      role: Role.MEMBER,
      organization: {
        id: 'db-org-1',
        name: 'DB Organization',
        slug: 'db-organization'
      }
    })) as typeof prisma.membership.findUnique;

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'provider-user-1',
        org_id: 'db-org-1',
        role: 'owner',
        email: 'member@example.com',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 3600
      })
    ).toString('base64url');
    const signingInput = `${header}.${payload}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signingInput)
      .sign(privateKey)
      .toString('base64url');

    const response = await callback(
      new Request(`http://localhost/api/auth/callback?token=${signingInput}.${signature}`)
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie') || '', /circuitsoul_session=/);

    const body = await response.json();
    assert.equal(body.user.id, 'db-user-1');
    assert.equal(body.organization.id, 'db-org-1');
    assert.equal(body.organization.role, Role.MEMBER);
    assert.equal(verifySessionToken(body.token)?.userId, 'db-user-1');
    assert.equal(verifySessionToken(body.token)?.role, Role.MEMBER);
  } finally {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.membership.findUnique = originalMembershipFindUnique;
    if (originalProvider === undefined) delete process.env.AUTH_PROVIDER;
    else process.env.AUTH_PROVIDER = originalProvider;
    if (originalClerkKey === undefined) delete process.env.CLERK_PUBLIC_KEY;
    else process.env.CLERK_PUBLIC_KEY = originalClerkKey;
  }
});
