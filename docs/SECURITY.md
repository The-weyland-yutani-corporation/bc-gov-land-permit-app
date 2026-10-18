# Security and privacy baseline

Detailed threat modelling belongs to the product and architecture task. Current
invariants are:

- authenticate application APIs and enforce tenant/project ownership
- keep Foundry and database access server-side
- use managed identity and least privilege where supported
- inject the web user-assigned identity client ID as `AZURE_CLIENT_ID` so
  `DefaultAzureCredential` selects that identity; never substitute an agent,
  project, or CI identity
- do not commit secrets, credentials, personal data, or generated cloud state
- minimize context sent to the agent and telemetry captured by default
- validate external, model, retrieval, and tool inputs
- prevent direct and indirect prompt injection from overriding system policy
- treat retrieved passages as untrusted evidence, remove and flag
  instruction-like lines, and never execute or obey retrieved directives
- authenticate Azure AI Search and optional Foundry embedding calls with managed
  identity through `DefaultAzureCredential`; do not use API keys
- preserve auditability without logging raw sensitive intake content
- use Entra External ID authorization code flow with PKCE, state, nonce, exact
  issuer/audience validation, and encrypted HTTP-only application sessions
- validate post-auth return paths against a fixed internal origin, reject
  encoded normalization bypasses, and never derive redirect trust from request
  host headers
- require database-backed subject and organization membership mapping; never
  derive tenant access from token claims alone
- permit deployed synthetic identity only with explicit environment approval and
  a deployment session secret; never fall back to it after identity errors

## Reporting a vulnerability

Never put credentials, applicant data, exploit details, or sensitive logs in a
public issue. If the repository's **Security → Report a vulnerability** control
is available, use GitHub private vulnerability reporting. Its availability and
the receiving maintainers have not been verified by this readiness change.

If private reporting is unavailable, ask the repository owner to establish a
private channel before sending details. A public issue may request a private
contact without describing the vulnerability. No monitored security mailbox,
response SLA, or production security certification is asserted here.

## Before distributing a demo

- Scan changed files and distributable Git history for secrets; rotate exposed
  credentials rather than merely deleting the current copy.
- Review locked dependencies and resolve applicable advisories.
- Confirm tenant-scoped access, server-only privileged calls, and deployed
  authentication behavior with the existing tests and appropriate security
  review.
- Review exported traces, screenshots, videos, and captions for real intake,
  precise customer locations, tokens, cloud identifiers, and browser
  notifications.
- Retain only synthetic public fixtures and approved/licensed source material.
- Record review scope and unresolved findings; automated checks alone are not a
  penetration test or authorization to deploy.
