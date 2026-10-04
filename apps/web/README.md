# Web application

The `apps/web` workspace is the Next.js App Router applicant experience. It
absorbs the original static visual proof while preserving the B.C.-inspired
semantic tokens, content-first layout, demo disclosure, and BC Mark placeholder.

## Run locally

```powershell
Copy-Item apps\web\.env.example apps\web\.env.local
pnpm --filter @permit-readiness/web dev
```

Open `http://localhost:3000`, choose **Sign in**, and use the explicit local
demo identity. Local development defaults to `APP_ENV=local`; its session key is
random per server process when `AUTH_SESSION_SECRET` is omitted.

Deployed synthetic identity is fail-closed. It requires all of `APP_ENV=dev`,
`AUTH_MODE=local-demo`, `ENABLE_SYNTHETIC_AUTH=true`, a strong
`AUTH_SESSION_SECRET`, initialized reference data, and the separately approved
demo-data seed. It remains prominently labelled and is never a fallback for
Entra External ID.

Without `DATABASE_URL`, an isolated process-memory repository stores synthetic
projects. When configured, the server selects the production Drizzle/PostgreSQL
adapter and enforces membership and organization ownership before operations.
Browser code never calls the database or the agent directly.

Production uses the server-side Entra External ID authorization-code flow with
PKCE, state, nonce, validated issuer/audience/lifetime, and an encrypted
HTTP-only application session. The verified External ID subject must already map
to a database user and membership in `ENTRA_EXTERNAL_ID_ORGANIZATION_ID`;
sign-in does not auto-provision access.

`/api/v1/health/ready` checks bounded runtime/auth configuration, the active
repository, PostgreSQL connectivity, identity data, and required reference data.
It returns `503` with non-sensitive dependency details when degraded.

Azure Maps is optional. Local development can use
`NEXT_PUBLIC_AZURE_MAPS_SUBSCRIPTION_KEY`; coordinate and GeoJSON entry remain
available if the map is missing or fails. Production browser token acquisition
must use the managed-identity/Entra adapter boundary rather than a public key.

## Validation

```powershell
pnpm --filter @permit-readiness/web lint
pnpm --filter @permit-readiness/web typecheck
pnpm --filter @permit-readiness/web test
pnpm --filter @permit-readiness/web build
pnpm --filter @permit-readiness/web test:e2e
```

No approved BC Mark artwork is bundled. Follow `public/brand/README.md` before
replacing the explicit placeholder.
