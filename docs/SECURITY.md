# Security and privacy baseline

Detailed threat modelling belongs to the product and architecture task. Current
invariants are:

- authenticate application APIs and enforce tenant/project ownership
- keep Foundry and database access server-side
- use managed identity and least privilege where supported
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
