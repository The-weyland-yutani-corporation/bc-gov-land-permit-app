# GitHub Actions workflows

`ci.yml` validates pull requests and relevant pushes to `main`. `deploy-dev.yml`
deploys `main` or a manual run to the protected development environment and
applies the Foundry smoke gate. `promote-production.yml` requires a full tested
commit SHA and reviewed baseline run. It discovers the candidate version in the
production Foundry project rather than accepting a development version number.

Actions are pinned to commit SHAs. Tokens default to `contents: read`; only
deployment jobs receive `id-token: write`. Azure access uses OIDC workload
identity federation. Never add client secrets or upload `.azure` state.

## Environments and federated identity

Create separate `development` and `production` GitHub environments. Configure
one Entra application or user-assigned identity per environment, using audience
`api://AzureADTokenExchange` and these subjects:

```text
repo:<owner>/<repository>:environment:development
repo:<owner>/<repository>:environment:production
```

Grant Contributor only on the matching resource group. Reviewed provisioning
also needs User Access Administrator, or an equivalent delegated custom role,
for `infra/RBAC.md`. Remove that role from deploy-only identities.

Required development variables are `DEV_AZURE_CLIENT_ID`, `DEV_AZURE_TENANT_ID`,
`DEV_AZURE_SUBSCRIPTION_ID`, `DEV_AZURE_ENV_NAME`, and `DEV_AZURE_LOCATION`;
`DEV_PROVISION_ON_MAIN` is optional. Required secrets are
`DEV_AZURE_POSTGRES_ADMIN_PASSWORD` and `DEV_DATABASE_URL`.

Production uses the distinct `PROD_AZURE_CLIENT_ID`, `PROD_AZURE_TENANT_ID`,
`PROD_AZURE_SUBSCRIPTION_ID`, `PROD_AZURE_ENV_NAME`, and `PROD_AZURE_LOCATION`
variables. External ID requires `PROD_ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN`,
`PROD_ENTRA_EXTERNAL_ID_CLIENT_ID`, `PROD_ENTRA_EXTERNAL_ID_AUTHORITY_HOST`, and
`PROD_ENTRA_EXTERNAL_ID_REDIRECT_URI`. Store
`PROD_AZURE_POSTGRES_ADMIN_PASSWORD`, `PROD_DATABASE_URL`, and
`PROD_ENTRA_EXTERNAL_ID_CLIENT_SECRET` as production environment secrets.

## Runners, protections, and branch strategy

CI uses GitHub-hosted runners. Deployments require ephemeral Linux x64
self-hosted runners labelled `development-vnet` or `production-vnet`. They must
connect only to the matching PostgreSQL/Container Apps VNet and provide Docker,
Azure CLI with the Container Apps extension, Git, `curl`, and `jq`. Database
URLs must use TLS; never open the private database firewall for CI.

Require CI before merging, disallow direct pushes to `main`, and restrict both
environments to trusted branches. Production must require reviewers, prevent
self-review, and retain deployment logs. The flow is feature branch -> pull
request -> `main` -> development. Production is manual and accepts only a full
40-character tested commit SHA and a reviewed baseline artifact run; mutable
refs are rejected. Hosted-agent version identifiers are environment-local and
must never be copied from development into production promotion inputs.

Provisioning is opt-in. Review Bicep what-if, model availability/quota, preview
terms, RBAC, and cost before setting the input. Migrations execute on the
VNet-connected runner before deployment, must be backward compatible, and verify
`PostGIS_Version()` afterward. Every deployment then initializes required
versioned database reference data and the approved guidance Search catalog
before `azd deploy`, health checks, hosted-agent invocation, or evaluations.
This ordering prevents a new application revision from receiving traffic while
its required catalog data is absent.

Development initializes deterministic demo identity/organization/project rows.
Production never does so by default: the dispatcher must explicitly select
`include_demo_data`, and protected-environment approval still applies. Required
reference and guidance catalog initialization always runs in production.

The OIDC deployment identity must have Search Service Contributor and Search
Index Data Contributor for index/schema and document synchronization. Do not
replace these roles with search keys.

## Gates, cost, and recovery

Development checks web liveness/readiness, exact agent status/version, a
version-pinned synthetic invocation, and the smoke threshold profile. Production
first captures the explicit 100% stable agent route and Container App revision.
It writes that stable agent rule into `azure.yaml`, applies it with
`azd ai agent endpoint update`, and pins Container App traffic before optional
`azd provision` or `azd deploy`. Production provisioning always sets
`WEB_CONTAINER_APP_MODE=existing`, so Bicep omits the Container App template and
ingress configuration. Both routes are read back immediately after provision and
must remain unambiguous and stable.

The workflow then diffs production agent versions and Container App revisions
before and after deployment. Exactly one new production agent version and one
new application revision must exist; otherwise promotion fails closed. The
candidate agent is invoked with `--version`, the candidate application revision
is checked through its direct revision FQDN, and the regression `eval.yaml` is
copied with `agent.version` pinned to that production version. Only after smoke,
health, regression, baseline, and protected `promote` job approval pass are both
public routes changed to the candidate.

Successful candidate runs upload `production-release-metadata`, including
`previous-release.json`, `candidate-release.json`, the stable-route
`rollback-azure.yaml`, non-secret release context, and gate evidence. Use a
candidate baseline only after reviewing failures, metric changes, and pinned
dataset/evaluator versions.

Pull requests never authenticate to Azure. Dev uses scale-to-zero, provisioning
is conditional, deployments are serialized, and artifact retention is bounded.
Configure budgets, quota alerts, ACR retention, and stale dev cleanup outside
the workflow. Do not schedule cloud evaluations until privacy, sampling, and
cost controls are approved.

Every failure or cancellation after deployment is attempted reapplies the
recorded stable agent endpoint configuration and Container App revision, then
reads both routes back. For manual rollback, dispatch the same workflow with
`operation=rollback` and `rollback_run_id=<promotion run id>`. The protected
rollback job downloads that run's immutable `production-release-metadata` and
restores the exact recorded versions; operators do not type version or revision
values. Never reverse an irreversible migration; roll forward or deploy
compatible code. See `docs/runbooks/azure-infrastructure.md`.
