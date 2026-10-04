# Contracts

Authored Zod schemas and ts-rest transport contracts shared by web handlers,
clients, tests, and bounded agent tools.

## Conventions

- The HTTP surface is rooted at `/api/v1`. Additive fields and routes are
  preferred. A breaking transport change requires a new explicit API or schema
  version and coordinated consumer migration.
- Identifiers crossing an ownership boundary are UUIDs. Configuration-owned
  catalog identifiers are lowercase slugs.
- Timestamps are offset-aware ISO 8601 strings. Calendar-only values use
  `YYYY-MM-DD`.
- Jurisdiction, content, rule, and guidance releases use semantic
  `VersionSchema` values. Foundry hosted-agent revisions use the separate
  `PlatformAgentVersionSchema`, which accepts platform identifiers such as
  numeric string `1`.
- GeoJSON is limited to validated `Point` and `Polygon` geometries. Polygon
  rings must be closed, non-zero, and non-self-intersecting.
- Errors use `ApiErrorSchema`; callers receive safe messages, correlation IDs,
  retryability, and optional field errors.
- Health liveness is dependency-free. Readiness reports only named dependency
  states and never connection or secret detail.

`AUTHORIZATION_CONVENTIONS` records the service expectations attached to the
contract. Health routes are public. Every other route requires verified
identity, active organization membership, and tenant-scoped service and
persistence checks. The contract package does not implement authorization.

The current stable ts-rest release has a Zod 3 peer range, so this workspace
uses ts-rest `3.52.1` with Zod `3.25.76`. Upgrade them together after a stable
ts-rest release supports the next Zod major.
