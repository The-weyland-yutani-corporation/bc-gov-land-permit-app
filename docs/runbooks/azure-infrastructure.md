# Azure infrastructure runbook

## Preflight

1. Confirm the target azd environment and `AZURE_ENV_PROFILE`.
2. Review model availability, quota, preview terms, and expected cost.
3. Run `npm run infra:validate`, Bicep build/parameter build, and repository
   validation.
4. Review `az deployment sub what-if`. Unexpected deletes, role changes, public
   network changes, or name replacement stop the deployment.
5. Confirm External ID and B.C. map prerequisites for production.

## Choose a deployment path

1. **Applicant demonstration only?** Use the
   [local walkthrough](customer-demo.md#local-setup-and-reset). No Azure
   resources are required, but local operation is not cloud integration
   evidence.
2. **Azure development demonstration?** Obtain a subscription/environment owner,
   approved region and model quota, cost approval, identities/RBAC, and the
   development VNet-connected runner described below. Review synthetic-auth
   approval explicitly; do not expose an unreviewed environment.
3. **Production candidate?** Also establish External ID registration and
   database membership onboarding, production runner/environment protections,
   privacy and records policies, accessibility/security review, operating
   ownership, and a verified stable release/rollback target. A successful
   deployment does not replace those approvals.

Use `infra/README.md`, `infra/RBAC.md`, and the environment tables below for the
full prerequisites. Do not advertise an unverified public demo URL.

### Cost and evidence handoff

Estimate costs for the selected region, SKU, capacity, retention, and expected
usage before provision: PostgreSQL, Search, Container Apps, Foundry model tokens
and hosted compute, registry, Maps, storage, logs, and network egress.
Scale-to-zero for the web does not make the full environment free. Set budgets,
quota alerts, an expiry date, and a named teardown owner. No fixed monthly
estimate is asserted.

For a field demonstration, record the tested source commit, agent/model
versions, configuration/rule/guidance releases, migrations, successful
browser/health checks, version-pinned cloud evaluation results, expected cost,
and rollback evidence. Keep secrets and raw sensitive inputs out of that
evidence. Local preflight is not a substitute for invoking and evaluating the
deployed candidate.

After the event, apply the teardown procedure below only to project-owned
resources. Separately review External ID, DNS, federated credentials, retained
artifacts, and any resources whose retention/purge settings prevent deletion.

## GitHub environment bootstrap

The deployment workflows create a local azd environment and set every
pre-provision value explicitly. They do not restore or upload `.azure` state.
Configure these values on the named GitHub environments, not as repository-level
secrets.

### `development`

| Type     | Name                                | Requirement                                                                                   |
| -------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| Variable | `DEV_AZURE_ENV_NAME`                | Unique dev azd environment name                                                               |
| Variable | `DEV_AZURE_LOCATION`                | Approved Azure region                                                                         |
| Variable | `DEV_AZURE_CLIENT_ID`               | OIDC application client ID                                                                    |
| Variable | `DEV_AZURE_TENANT_ID`               | OIDC tenant ID                                                                                |
| Variable | `DEV_AZURE_SUBSCRIPTION_ID`         | Dev subscription ID                                                                           |
| Variable | `DEV_PROVISION_ON_MAIN`             | `true` only when main may provision automatically; otherwise `false`                          |
| Variable | `DEV_ENABLE_SYNTHETIC_AUTH`         | Secure default is `false`; this demo deployment requires an explicit reviewed value of `true` |
| Secret   | `DEV_AZURE_POSTGRES_ADMIN_PASSWORD` | Strong dev-only PostgreSQL administrator password                                             |
| Secret   | `DEV_AUTH_SESSION_SECRET`           | Dev-only high-entropy value of at least 32 characters                                         |
| Secret   | `DEV_DATABASE_URL`                  | TLS PostgreSQL URL reachable from the development runner                                      |

Restrict deployment branches to `main` and authorized manual dispatches. Allow
only the development VNet runner group to use the environment. Synthetic auth
must remain visibly demo-only; removal or a value other than `true` fails the
pre-provision validator rather than enabling an implicit fallback.

### `production`

| Type     | Name                                      | Requirement                                                  |
| -------- | ----------------------------------------- | ------------------------------------------------------------ |
| Variable | `PROD_AZURE_ENV_NAME`                     | Unique production azd environment name                       |
| Variable | `PROD_AZURE_LOCATION`                     | Approved production region                                   |
| Variable | `PROD_AZURE_CLIENT_ID`                    | Production OIDC application client ID                        |
| Variable | `PROD_AZURE_TENANT_ID`                    | Production OIDC tenant ID                                    |
| Variable | `PROD_AZURE_SUBSCRIPTION_ID`              | Production subscription ID                                   |
| Variable | `PROD_ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN` | External ID tenant subdomain                                 |
| Variable | `PROD_ENTRA_EXTERNAL_ID_CLIENT_ID`        | External ID application client ID                            |
| Variable | `PROD_ENTRA_EXTERNAL_ID_AUTHORITY_HOST`   | `https://<subdomain>.ciamlogin.com`                          |
| Variable | `PROD_ENTRA_EXTERNAL_ID_REDIRECT_URI`     | Exact non-localhost production callback URI                  |
| Variable | `PROD_ENTRA_EXTERNAL_ID_ISSUER`           | HTTPS issuer on the configured CIAM host                     |
| Variable | `PROD_ENTRA_EXTERNAL_ID_ORGANIZATION_ID`  | Seeded production application organization ID                |
| Secret   | `PROD_AZURE_POSTGRES_ADMIN_PASSWORD`      | Strong production-only PostgreSQL administrator password     |
| Secret   | `PROD_AUTH_SESSION_SECRET`                | Production-only high-entropy value of at least 32 characters |
| Secret   | `PROD_ENTRA_EXTERNAL_ID_CLIENT_SECRET`    | External ID application credential                           |
| Secret   | `PROD_DATABASE_URL`                       | TLS PostgreSQL URL reachable from the production runner      |

Require production reviewers, prevent self-review, restrict deployments to the
approved release branch, and limit the environment to the production VNet runner
group. Keep environment administrators and secret writers separate from release
approvers where GitHub organization controls permit it. Candidate staging,
provisioning, final promotion, and rollback all use the protected `production`
environment; no production secret may be copied into repository variables,
artifacts, logs, or `.azure` state uploads.

Production release automation fixes `WEB_CONTAINER_APP_MODE=existing`.
Provisioning therefore references the current Container App for outputs but does
not submit its template, image, environment, or ingress traffic to ARM.

The web Container App has a user-assigned managed identity. Bicep injects that
identity's client ID as `AZURE_CLIENT_ID`, allowing Azure SDK
`DefaultAzureCredential` to select the correct identity for server-side Foundry
and other Azure calls. This value is an identity selector, not a credential or
secret. The `postdeploy` synchronization hook also applies the selector to
pre-existing Container Apps while it updates the hosted-agent endpoint, so
environments created before this setting was introduced are migrated on their
next deployment.

## Provision and release

An authorized operator may run `azd provision`; Foundry azd commands must use
`AZURE_DEV_USER_AGENT=microsoft_foundry_skill`. Before an existing production
environment is provisioned, capture, pin, and verify the stable agent version
and Container App revision. Keep `WEB_CONTAINER_APP_MODE=existing` throughout
the update and verify both routes again immediately afterward.

For a fresh environment, first use `WEB_CONTAINER_APP_MODE=base` to create
shared infrastructure without a Container App. Deploy the hosted agent and
publish the approved web image. Then set `WEB_CONTAINER_APP_MODE=bootstrap`,
`WEB_CONTAINER_IMAGE` to an immutable `@sha256:` reference, and
`AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT` to the HTTPS endpoint. The
pre-provision hook fails if any bootstrap value is absent. After that one-time
creation, return permanently to `existing`.

After provisioning:

1. run database migrations from a VNet-connected runner and verify PostGIS with
   `SELECT PostGIS_Version();`;
2. run `pnpm db:initialize` for required versioned reference data;
3. optionally run `ALLOW_DEMO_DATA=true pnpm db:seed:demo` only for an
   explicitly approved demonstration environment;
4. run `pnpm guidance:initialize` with the checked-in deployment catalog using
   the OIDC/managed identity;
5. capture the explicit stable production agent route and Container App traffic;
6. pin both public routes to those stable versions and read them back;
7. optionally provision reviewed infrastructure in `existing` mode and verify
   both stable routes again;
8. run the postdeploy synchronization once before the candidate snapshot to
   migrate `AZURE_CLIENT_ID` and the hosted-agent endpoint on older Container
   Apps, then verify traffic still targets the stable revision;
9. deploy the hosted agent and web services with `azd deploy`;
10. discover the newly created versions in production by comparing predeploy and
    postdeploy production state;
11. invoke the exact production agent candidate with `--version`, check the
    candidate Container App revision FQDN, and run regression evaluation with
    `agent.version` pinned to the same production version;
12. after protected approval, route both public endpoints to the candidate and
    read them back;
13. verify correlated web, agent, model, Search, and database telemetry.

Do not move initialization after deployment or health checks. A deployment
failure must leave traffic on the prior revision rather than expose a candidate
whose required database or Search catalog is incomplete.

Record the Container App revision, agent name/version, model deployment,
configuration release, guidance release, and migration version.

## Rollback

1. Find the workflow run that promoted the release being reversed.
2. Dispatch **Promote production** with `operation=rollback` and set
   `rollback_run_id` to that run. Do not enter version identifiers manually.
3. The protected rollback job downloads `production-release-metadata`, restores
   `rollback-azure.yaml` with `azd ai agent endpoint update`, routes Container
   App traffic to `stableAppRevision`, and verifies both read-backs.
4. Re-run public health checks and preserve `production-manual-rollback-result`.
5. Restore the previous configuration and guidance release if they were
   independently promoted.
6. Do not roll back an irreversible migration. Migrations must remain backward
   compatible throughout the rollback window.
7. Re-run synthetic checks, then record the incident timeline.

GitHub Actions automatically attempts both agent-route and Container App traffic
restoration on failure or cancellation after candidate deployment, and again if
final promotion fails. Workflow evidence contains no credentials or generated
`.azure` state; `release-context.json` uses an explicit non-secret allow-list.

## Teardown

Use `azd down --purge` only for an environment wholly owned by this project.
Export required audit/evaluation records and confirm retention obligations
first. Production Key Vault purge protection can prevent immediate name reuse.
External ID registrations, federated credentials, DNS, budgets, and data
approvals require separate cleanup.

## Failure triage

- **Agent endpoint absent:** inspect
  `AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT` and run
  `node scripts/infra/sync-agent-endpoint.mjs`.
- **Database DNS/TLS failure:** test from the Container Apps VNet, confirm the
  private DNS link, and keep `DATABASE_SSL_MODE=verify-full`.
- **403 from Search/Storage/Maps/Foundry:** inspect identity selection and
  [`infra/RBAC.md`](../../infra/RBAC.md); do not add access keys.
- **Model deployment failure:** verify the literal deployment name, model
  availability, version, SKU, capacity, and regional quota.
- **Key Vault reference failure:** verify the web identity, Secrets User role,
  secret existence, and versionless URI.
