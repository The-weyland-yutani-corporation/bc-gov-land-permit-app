# Permit Readiness Navigator guidance

- Follow root `AGENTS.md` and the boundaries in `ARCHITECTURE.md`.
- Use the `microsoft-foundry` skill when changing hosted-agent protocol,
  identity, model access, packaging, or deployment assumptions.
- Implement the Foundry Responses protocol contract exactly; protocol changes
  require contract and compatibility tests.
- Reuse schemas from `packages/contracts` for tool inputs and structured output.
- Treat deterministic domain tools as authoritative for permit triggers. The
  model may explain results but must not invent requirements.
- Give the agent minimized project context and no general-purpose database
  credential.
- Defend against direct and retrieved prompt injection, do not expose hidden
  instructions or cross-user data, and keep non-binding uncertainty explicit.
- Add deterministic protocol/tool tests and relevant evaluation cases for every
  behavior change.
- Keep container packaging compatible with root `azure.yaml` and Bicep; do not
  provision or deploy Azure resources from this application directory.
