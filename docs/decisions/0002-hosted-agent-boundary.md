# ADR-0002: Hosted-agent boundary

- Status: Accepted
- Date: 2026-10-03

## Context

The product needs conversational clarification and grounded explanation without
allowing a probabilistic model to become the source of permit truth or a path
around tenant authorization.

## Decision

Run one TypeScript Permit Readiness Navigator as a Microsoft Foundry hosted
container using the Responses protocol. The authenticated Next.js server is the
only application caller. It authorizes the project, sends minimized normalized
context, and validates the returned structured contract.

The agent can use only allow-listed typed tools. Permit triggers,
missing-information checks, sequencing, tenant checks, and persistence remain
deterministic application responsibilities. Guidance retrieval is limited to a
curated, versioned index. The agent receives no general database credential and
cannot persist state directly.

## Consequences

- The agent can be evaluated, versioned, replaced, or degraded independently.
- Tool and report contracts are security boundaries and require compatibility
  tests.
- Server-to-agent latency and preview-service availability need timeouts,
  retries, fallbacks, and version-aware rollback.
- The application must reject malformed, unsupported, or contradictory model
  output rather than repairing it silently.

## Alternatives rejected

- Browser-to-Foundry calls: exposes authorization and service credentials.
- Agent with direct database access: creates excessive privilege and weakens
  deterministic ownership checks.
- Model-decided permit triggers: untestable and inappropriate for non-binding
  regulatory preparation.
- Multi-agent orchestration: unnecessary complexity for the first journey.
