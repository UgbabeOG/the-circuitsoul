# Authentication and session lifecycle

CircuitSoul uses provider authentication only to establish an internal account
identity. Application APIs accept only CircuitSoul HMAC sessions; a Clerk JWT
is never an application session.

## Clerk configuration

Set these server-side environment variables when `AUTH_PROVIDER=clerk`:

- `CLERK_JWKS_URL`: HTTPS URL for the issuer's JWKS document.
- `CLERK_ISSUER_URL`: exact `iss` claim expected in provider tokens.
- `CLERK_AUDIENCE`: required audience in provider tokens.
- `CIRCUITSOUL_AUTH_SECRET`: high-entropy secret used to sign internal sessions.

Provider tokens must use RS256, a published RSA signing key, an unexpired `exp`,
the exact issuer, the configured audience, and a verified email claim. JWKS
keys are cached briefly and refreshed when a key ID is unknown. The callback
requires a short-lived, HttpOnly state cookie and a matching state in its POST
body; token values are not accepted in callback URLs.

The callback links an unlinked provider subject to an existing CircuitSoul user
only by verified matching email, then persists the provider/subject mapping.
It requires an existing membership in the organization identified by the
verified provider token. It does not create users or memberships.

## Internal sessions

The callback issues a signed HMAC session in the HttpOnly
`circuitsoul_session` cookie. Protected APIs accept this internal token from
that cookie or an explicit `Authorization: Bearer` header. They do not trust
the `x-circuitsoul-session` or `x-circuitsoul-org-id` headers. Membership and
role are reloaded from the database for protected organization access; the
role embedded in a token is not authoritative.

Refresh checks the current membership and role, revokes the old token, and
places the replacement only in the HttpOnly cookie. Logout revokes the current
token and clears the cookie. Revocation records store token hashes, not bearer
tokens. Session tokens use `Secure` cookies in production and `SameSite=Lax`.

The platform Admin application has a separate server-side allowlist:
`CIRCUITSOUL_PLATFORM_ADMIN_EMAILS`. Tenant OWNER/ADMIN membership does not
grant platform-admin access. An unset or empty allowlist denies everyone.

## Limitations and required rollout checks

- The API currently requires an existing internal user and organization
  membership; account and organization provisioning are separate operations.
- The repository does not include a complete Clerk browser sign-in UI. The
  client must obtain a provider token and submit it with the state returned by
  `/api/auth/signin` to the POST callback.
- State-cookie binding is implemented; an OIDC nonce challenge/claim is not
  yet integrated with a Clerk browser flow. Do not treat this as proof of
  end-to-end OIDC nonce validation.
- Use a distinct, randomly generated `CIRCUITSOUL_AUTH_SECRET` per environment.
  Rotation invalidates existing sessions; plan a user reauthentication window.
- Do not enable `ALLOW_DEV_SESSION` outside isolated local development.

Before staging, verify Clerk's actual token claims and signing-key rotation
behavior, callback cookie settings behind the production proxy, session
revocation persistence, role downgrade behavior, and cross-organization denial.
