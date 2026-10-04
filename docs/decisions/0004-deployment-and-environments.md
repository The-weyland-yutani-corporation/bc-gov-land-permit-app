# ADR-0004: Deployment and environment strategy

- Status: Accepted
- Date: 2026-10-03

## Context

The repository must demonstrate inspectable Azure deployment, separate
application and hosted-agent releases, safe production promotion, and practical
rollback without creating infrastructure during the architecture task.

## Decision

Use one root `azure.yaml` as the deployment graph and ejected, reviewed Bicep as
the infrastructure authority. Deploy the Next.js application to Azure Container
Apps and the TypeScript agent as a separately versioned Foundry hosted container
from Azure Container Registry. Provision PostgreSQL/PostGIS, curated search,
Maps, Key Vault, telemetry, storage, managed identities, and least-privilege
RBAC through the same reviewed graph.

Maintain isolated `dev` and `prod` environments:

- `dev` uses synthetic data and cost-conscious settings and is deployed after
  main-branch quality gates.
- `prod` uses protected GitHub environment approval, stronger security and
  retention settings, immutable application/agent candidates, smoke and
  regression evaluation, and explicit promotion.

Environments do not share data stores, indexes, identities, secrets, or runtime
state. GitHub Actions authenticates through OIDC. Record the previously active
application revision, agent version, configuration release, and database
migration compatibility before promotion.

## Consequences

- Infrastructure is reproducible and customer-customizable without normalizing
  portal drift.
- Application and agent versions can be validated together and rolled back
  deliberately.
- Database migrations must be backward-compatible across the rollback window.
- Full private-network isolation may require a documented production hardening
  profile beyond the minimum reusable demo topology.
- Regional model availability, quota, preview status, and cost must be checked
  during implementation rather than hardcoded now.

## Alternatives rejected

- Manual portal deployment: not auditable or reproducible.
- One shared environment: unsafe data and release coupling.
- Deploy production directly from `main`: lacks candidate validation and
  approval.
- Pinning production to an unversioned latest agent: prevents reliable
  evaluation and rollback.
