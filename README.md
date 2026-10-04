# Public-Sector Permit Readiness Demo

An Azure-native reference repository for a reusable public-sector permitting
journey and a Microsoft Foundry-hosted Permit Readiness Navigator.

The repository contains a complete local reference journey, deterministic rule
engine, PostgreSQL/PostGIS persistence, curated guidance search, Foundry hosted
agent, evaluation assets, and reviewed Azure deployment infrastructure. The
local journey runs without cloud credentials; Azure provisioning and remote
evaluation require an authorized environment and explicit cost approval.

## Prerequisites

- Node.js 20 or newer
- Corepack
- PostgreSQL 16 with PostGIS 3.x for migration, seed, and integration workflows

## Quick start

```powershell
corepack enable
pnpm install
pnpm validate
```

## Canonical commands

| Command               | Purpose                                                         |
| --------------------- | --------------------------------------------------------------- |
| `pnpm dev`            | Run development tasks for every workspace                       |
| `pnpm build`          | Compile every workspace to its ignored `dist` directory         |
| `pnpm db:check`       | Validate Drizzle migration history                              |
| `pnpm db:migrate`     | Apply PostgreSQL/PostGIS migrations                             |
| `pnpm db:verify`      | Verify that PostGIS is available after migration                |
| `pnpm db:initialize`  | Initialize required versioned reference data                    |
| `pnpm db:seed:demo`   | Explicitly initialize optional synthetic demo rows              |
| `pnpm lint`           | Check workspace manifests, boundaries, and repository structure |
| `pnpm typecheck`      | Type-check every workspace without emitting files               |
| `pnpm test`           | Run workspace, boundary, infrastructure, and workflow tests     |
| `pnpm format`         | Format supported repository files with Prettier                 |
| `pnpm format:check`   | Verify formatting without changing files                        |
| `pnpm infra:validate` | Validate the azd/Bicep contract without contacting Azure        |
| `pnpm validate`       | Run format, lint, typecheck, test, and build checks             |

`pnpm --filter @permit-readiness/web dev` starts the local applicant experience.
The shared library workspaces have no long-running development process; their
`dev` tasks report that boundary and exit.

## Repository map

- `apps/web` — Next.js applicant experience and server boundary
- `apps/permit-readiness-agent` — Foundry Responses protocol service
- `packages/contracts` — shared transport and tool contracts
- `packages/db` — persistence adapters and migrations
- `packages/domain` — deterministic business rules and domain services
- `packages/jurisdiction-config` — versioned jurisdiction configuration
- `packages/observability` — shared telemetry conventions
- `packages/test-utils` — shared deterministic test fixtures
- `packages/ui` — shared accessible presentation primitives
- `infra` — unified `azd`, Bicep, identity, RBAC, and environment graph
- `docs` — product, design, decision, operations, and reference documentation

Start with [AGENTS.md](AGENTS.md) for contribution routing. Durable product,
design, and system boundaries live in [PRODUCT.md](PRODUCT.md),
[DESIGN.md](DESIGN.md), and [ARCHITECTURE.md](ARCHITECTURE.md). The detailed
documentation index is in [docs/README.md](docs/README.md).

For delivery teams, use the
[customer demonstration walkthrough](docs/runbooks/customer-demo.md) and the
[adaptation guide](docs/design-docs/adapting-the-reference.md).

## Product status

This is a demonstration/reference implementation, not an official government
service and not a source of binding legal or permitting decisions.
