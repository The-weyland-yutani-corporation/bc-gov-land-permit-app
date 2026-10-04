# Permit Readiness Navigator

TypeScript/Node hosted agent implementing the Microsoft Foundry Responses
protocol `2.0.0`. It listens on port `8088`, exposes `POST /responses`,
`GET /readiness`, and `GET /health`, and uses the Foundry project endpoint with
`DefaultAzureCredential`. No API keys are supported.

The web application invokes this endpoint only from its server-side adapter.
Project, organization, run, and correlation identifiers are validated before any
typed tool executes. The agent does not have a database credential.

## Responsibilities

- Orchestrate the applicant conversation without making binding decisions.
- Treat deterministic rule and sequence tools as authoritative.
- Preserve missing information, assumptions, uncertainty, and escalation.
- Use only approved guidance citations. `search_permit_guidance` is an interface
  in this task; its Azure AI Search implementation is intentionally deferred.
- Keep citation metadata, excerpts, safety flags, and composed reports
  server-owned. The model returns only grounded citation IDs and an optional
  validated report ID; the orchestrator reconstructs the authoritative output.
- Validate structured output and retry only bounded, retryable output failures.
- Reject malformed protocol input, tool arguments, cross-scope requests, and
  unsupported output instead of returning success-shaped fallbacks.

The available tools are:

1. `get_project_context`
2. `identify_missing_information`
3. `evaluate_permit_triggers`
4. `search_permit_guidance`
5. `build_permit_sequence`
6. `compose_readiness_report`

## Local development

Copy `.env.example` to a local, ignored environment file and set:

- `FOUNDRY_PROJECT_ENDPOINT` to the project endpoint
  (`https://...services.ai.azure.com/api/projects/...`);
- `FOUNDRY_MODEL_NAME` to the model deployment name.
- `FOUNDRY_AGENT_VERSION` to the Foundry-hosted numeric revision, for example
  `1`.

Authenticate locally with Azure CLI or another `DefaultAzureCredential`
provider. Managed identity is used in hosted environments.

```powershell
corepack pnpm install
corepack pnpm --filter @permit-readiness/agent build
corepack pnpm --filter @permit-readiness/agent start
```

Invoke the local server with an OpenAI Responses request whose `input` is a
JSON-serialized `AgentInvocationEnvelopeSchema`. The web adapter constructs this
envelope. A representative credential-free invocation using a fake model is:

```powershell
corepack pnpm --filter @permit-readiness/agent smoke
```

Run focused validation with:

```powershell
corepack pnpm --filter @permit-readiness/agent lint
corepack pnpm --filter @permit-readiness/agent typecheck
corepack pnpm --filter @permit-readiness/agent test
```

## Evaluation workspace

`eval.yaml` plus the versioned `.foundry/datasets`, `.foundry/evaluators`, and
`.foundry/suites` folders define smoke and regression intent. Local preflight
does not call Azure or a model:

```powershell
corepack pnpm --filter @permit-readiness/agent eval:preflight
```

Do not run `azd ai agent eval run` until a deployed, invokable agent and Foundry
project exist. Dataset refresh, remote execution, thresholds, baseline
comparison, and future continuous evaluation are documented in
[`docs/runbooks/foundry-evaluations.md`](../../docs/runbooks/foundry-evaluations.md).

## Container

Build from the repository root so workspace packages are available:

```powershell
docker build --platform linux/amd64 `
  -f apps/permit-readiness-agent/Dockerfile `
  -t permit-readiness-agent:local .
```

The image is multi-stage, runs as the non-root `node` user, serves plain
HTTP/1.1 on `0.0.0.0:8088`, starts OpenTelemetry before application imports, and
handles `SIGTERM` gracefully. Foundry terminates TLS and injects `FOUNDRY_*` and
`APPLICATIONINSIGHTS_CONNECTION_STRING` values.

This package deliberately does not include `azure.yaml`, Bicep, Azure resource
deployment, or an Azure AI Search implementation. Its startup command is:

```text
node --import @azure/monitor-opentelemetry/loader \
  --import ./dist/instrumentation.js --enable-source-maps dist/index.js
```

## Web adapter configuration

The default remains deterministic local demo mode:

```text
PERMIT_AGENT_MODE=local
```

To use the hosted endpoint from the web server:

```text
PERMIT_AGENT_MODE=remote
PERMIT_AGENT_ENDPOINT=https://<dedicated-agent-endpoint>
PERMIT_AGENT_NAME=permit-readiness-agent
PERMIT_AGENT_TOKEN_SCOPE=https://ai.azure.com/.default
PERMIT_AGENT_TIMEOUT_MS=45000
```

Remote errors are surfaced as unavailable; they do not silently become a
successful local response. Switching back to `local` is the explicit demo
fallback.
