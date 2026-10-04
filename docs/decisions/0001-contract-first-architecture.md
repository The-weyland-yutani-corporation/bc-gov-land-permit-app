# ADR-0001: Contract-first architecture

- Status: Accepted
- Date: 2026-10-03

## Context

The browser, Next.js server, deterministic domain, database adapters, hosted
agent, and tests exchange related data. Independently defined shapes would
drift, weaken validation, and make agent output unsafe to persist.

## Decision

Define cross-process and cross-workspace API, tool, event, error, and structured
output shapes first in `packages/contracts` using Zod and ts-rest where
applicable. Consumers import authored contracts and infer types from them.
Contracts remain transport-focused; business orchestration, database models,
framework request objects, and UI state stay outside the package.

Prefer additive compatible changes. Breaking changes require explicit
versioning, rationale, migration notes, compatibility tests, and updates to all
consumers in one change.

The initial authored surface uses `/api/v1`, configuration schema `1.0.0`, and
contract version `1.0.0`. Ownership identifiers are UUIDs; configuration-owned
catalog keys are slugs; external timestamps are offset-aware ISO 8601 values.
Authorization expectations are documented with the contracts but implemented in
organization-scoped application services and persistence predicates.

The initial dependency pair is ts-rest `3.52.1` and Zod `3.25.76`, the current
compatible stable releases when the foundation was authored. Their major
versions are upgraded together rather than bypassing ts-rest peer compatibility.

## Consequences

- Boundary validation and tests share one source.
- Agent tools and report output are inspectable before model integration.
- Domain and persistence models may need explicit mapping rather than leaking
  through APIs.
- Contract changes become an intentional coordination point.

## Alternatives rejected

- Generate contracts from database schema: couples public behavior to storage.
- Define types independently in each application: permits silent drift.
- Share all internal models: creates cycles and exposes implementation details.
