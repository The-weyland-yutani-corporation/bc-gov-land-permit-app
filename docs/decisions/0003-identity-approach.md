# ADR-0003: Identity approach

- Status: Accepted
- Date: 2026-10-03

## Context

The reference app needs a credible applicant identity pattern while remaining
runnable for local demonstrations. It must not imply integration with B.C.
production identity services.

## Decision

Use Microsoft Entra External ID for deployed applicant authentication. Map the
verified external subject to an application user and explicit organization
membership; derive authorization from server-side membership and project scope,
not token claims or object identifiers alone.

Provide a separate local demo adapter for development and automated testing. It
is enabled only by an explicit non-production setting, uses synthetic seeded
identities, and displays a persistent demo indication. Production startup or
deployment validation fails if local demo auth is enabled.

Use workload managed identities for service-to-service Azure access and GitHub
OIDC for deployment. Entra External ID registration is a documented external
prerequisite because it may be administered outside the workload tenant.

## Consequences

- Application authorization remains stable if the external identity provider is
  replaced.
- Teams need repeatable tenant/app-registration and redirect-URI setup.
- Local testing is reliable without weakening deployed authentication.
- Account linking, recovery, consent, and privacy flows require explicit product
  work before production adoption.

## Alternatives rejected

- BC Services Card or BCeID in the reference release: unavailable as a generic,
  reusable integration and would imply official service status.
- Local demo identity in production: unacceptable bypass risk.
- Authorization solely from identity-provider groups/claims: couples tenancy to
  provider administration and does not protect project ownership by itself.
