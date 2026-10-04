# Azure infrastructure

The root [`azure.yaml`](../azure.yaml) is the unified `azd` graph. Checked-in
Bicep is the provisioning authority for the workload and the `azure.ai.project`
Foundry resources. The TypeScript agent remains an `azure.ai.agent` container
service, while Next.js deploys to the provisioned Container App.

No deployment command should run until environment, cost, quota, external
prerequisites, and change approval are reviewed.

## Topology

- public HTTPS ingress to the Next.js Container App;
- VNet-integrated Container Apps environment;
- private PostgreSQL Flexible Server with TLS, private DNS, and PostGIS;
- Foundry account/project, model deployment, and hosted agent container;
- keyless Search, Maps, Storage, ACR, Key Vault, and telemetry access;
- managed identities for the web app and Foundry project; and
- Key Vault references only for PostgreSQL password authentication and the
  External ID confidential-client and application-session secrets.

The production profile strengthens replicas, compute, storage redundancy,
retention, purge protection, and revision rollback. Public data-plane access
remains enabled for hosted-agent dependencies, with local authentication
disabled where supported. This accommodates the hosted-agent container preview;
adopters must revalidate private networking support before production.

## Environment setup

Use [`.azure/dev.env.example`](../.azure/dev.env.example) or
[`prod.env.example`](../.azure/prod.env.example) as a list of variable names.
Set sensitive values with `azd env set`; never write them into parameters.

```powershell
$env:AZURE_DEV_USER_AGENT = 'microsoft_foundry_skill'
azd env new permit-readiness-dev
azd env set AZURE_ENV_PROFILE dev
azd env set AZURE_LOCATION canadacentral
azd env set AZURE_SUBSCRIPTION_ID <subscription-guid>
azd env set AZURE_POSTGRES_ADMIN_PASSWORD <generated-secret>
azd env set AUTH_SESSION_SECRET <generated-32-plus-character-secret>
azd env set ENABLE_SYNTHETIC_AUTH true
azd env set WEB_CONTAINER_APP_MODE existing
```

The dev profile requires the explicit synthetic-auth setting shown above; also
run `pnpm db:initialize`, then set `ALLOW_DEMO_DATA=true` for the approved
operator session and run `pnpm db:seed:demo` before the app can become ready.
Production requires every `ENTRA_EXTERNAL_ID_*` value in the example. The
pre-provision hook fails closed when required inputs are absent.

`WEB_CONTAINER_APP_MODE` is always explicit:

- `base` provisions the Container Apps environment but not the web app;
- `bootstrap` creates the web app once and requires `WEB_CONTAINER_IMAGE` plus
  an HTTPS `AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT`; production also
  requires the image to be pinned by `@sha256:<digest>`; and
- `existing` references the deployed app for outputs while omitting its
  resource, template, image, and ingress configuration from the deployment.

Use `existing` for every infrastructure update after bootstrap. A fresh
environment is staged deliberately: provision `base`, deploy the hosted agent
and publish the approved web image, then provision once with `bootstrap` and the
explicit endpoint and immutable image. There is no fallback image.

## Validate and preview

These commands do not provision resources:

```powershell
npm run infra:validate
az bicep build --file infra/main.bicep --stdout > $null

$env:AZURE_POSTGRES_ADMIN_PASSWORD = '<validation-only>'
$env:AUTH_SESSION_SECRET = 'validation-only-session-secret-32-chars'
$env:ENABLE_SYNTHETIC_AUTH = 'true'
$env:WEB_CONTAINER_APP_MODE = 'existing'
az bicep build-params --file infra/parameters/dev.bicepparam --stdout > $null

$env:ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN = 'validation-only'
$env:ENTRA_EXTERNAL_ID_CLIENT_ID = '00000000-0000-4000-8000-000000000000'
$env:ENTRA_EXTERNAL_ID_CLIENT_SECRET = 'validation-only-not-a-secret'
$env:ENTRA_EXTERNAL_ID_AUTHORITY_HOST = 'https://validation-only.ciamlogin.com'
$env:ENTRA_EXTERNAL_ID_REDIRECT_URI = 'https://example.invalid/api/auth/callback/entra'
$env:ENTRA_EXTERNAL_ID_ISSUER = 'https://validation-only.ciamlogin.com/tenant/v2.0'
$env:ENTRA_EXTERNAL_ID_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001'
$env:WEB_CONTAINER_APP_MODE = 'existing'
az bicep build-params --file infra/parameters/prod.bicepparam --stdout > $null
```

These values compile the parameter contract only. They are not deployable
credentials and must never be copied into an azd environment.

An authenticated operator may run a subscription what-if after review:

```powershell
az deployment sub what-if `
  --location canadacentral `
  --template-file infra/main.bicep `
  --parameters infra/parameters/dev.bicepparam
```

`azd provision` and `azd deploy` are intentionally excluded from repository
validation. Production automation pins and verifies the stable agent and web
routes before optional provisioning, provisions with
`WEB_CONTAINER_APP_MODE=existing`, and verifies both routes again afterward.
After a later `azd deploy`, the post-deploy hook reads the hosted Responses
endpoint emitted by Foundry and updates `PERMIT_AGENT_ENDPOINT` on the candidate
Container App revision.

## PostgreSQL and PostGIS

The server disables public access, uses a delegated subnet/private DNS, and sets
`require_secure_transport=on`. Bicep allow-lists `POSTGIS` through
`azure.extensions`. The initial migration runs:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Run `pnpm db:migrate` from an approved VNet-connected runner, such as a
temporary Container Apps job or private CI runner. Do not open the database
firewall for convenience.

## Lifecycle

Follow
[`docs/runbooks/azure-infrastructure.md`](../docs/runbooks/azure-infrastructure.md)
for provisioning, migration, release, rollback, and teardown. For an environment
wholly owned by this project, `azd down --purge` removes the resource group
after required records are exported. Production Key Vault purge protection can
intentionally delay complete name reuse.

- [RBAC matrix](RBAC.md)
- [External prerequisites](PREREQUISITES.md)
- [Environment parameters](parameters/README.md)
- [Module inventory](modules/README.md)
