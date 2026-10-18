# Repository routing guide

## Purpose

This repository is a reusable public-sector permit-readiness reference app. It
contains a Next.js application, deterministic permit reasoning, PostgreSQL and
PostGIS persistence, and a Microsoft Foundry-hosted TypeScript agent.

This is a demonstration, not an official service or source of binding legal
decisions.

## Read first

- Product truth and non-goals: `PRODUCT.md`
- Proven visual rules: `DESIGN.md`
- System boundaries: `ARCHITECTURE.md`
- Documentation map: `docs/README.md`
- Security baseline: `docs/SECURITY.md`
- Reliability baseline: `docs/RELIABILITY.md`
- Read the nearest co-located `AGENTS.md` before changing a governed area.

## Workspace map

- `apps/web`: applicant UI, authenticated server boundary, and API handlers
- `apps/permit-readiness-agent`: Foundry Responses protocol and typed tools
- `packages/contracts`: shared transport and agent-tool schemas
- `packages/domain`: deterministic domain behavior
- `packages/db`: schema, migrations, and persistence adapters
- `packages/jurisdiction-config`: versioned customer and jurisdiction settings
- `packages/ui`: accessible shared UI primitives
- `packages/observability`: telemetry conventions
- `packages/test-utils`: deterministic fixtures and helpers
- `infra`: `azd`, Bicep, environment parameters, identities, and RBAC

## Tooling

Use the pinned pnpm version through Corepack. Canonical commands are:

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm format`
- `pnpm format:check`
- `pnpm validate`

Do not document a repository command unless it exists and works.

## Boundaries

- Define external and cross-workspace shapes in `packages/contracts` first.
- Keep permit trigger decisions deterministic; agents explain but do not invent.
- Browser code never calls Foundry or the database directly.
- Domain services do not depend on UI, framework, or infrastructure modules.
- Database access stays behind repository/service interfaces.
- Jurisdiction-specific content belongs in versioned configuration, not forks.
- Infrastructure consumes application contracts; application packages do not
  import infrastructure code.

## Change rules

- Prefer additive, backward-compatible contract changes. Document breaking
  changes and update all consumers in one change.
- Never edit an applied database migration. Add a new migration and test both
  upgrade behavior and ownership constraints.
- Keep user and tenant ownership checks explicit in services and database
  constraints.
- Do not commit credentials, personal data, generated cloud state, or raw
  sensitive intake content.
- Preserve a visible demonstration/non-official indicator unless an authorized
  deployment explicitly replaces it.
- Target WCAG 2.2 AA, keyboard operation, visible focus, semantic HTML, and
  reduced-motion support.
- Add or update tests with behavior changes and run the narrowest relevant
  checks before `pnpm validate`.
