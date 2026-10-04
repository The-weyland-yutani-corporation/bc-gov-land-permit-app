#!/usr/bin/env bash
set -euo pipefail

stable_agent_version="${1:?stable agent version is required}"
stable_app_revision="${2:?stable app revision is required}"
evidence_prefix="${3:?evidence prefix is required}"

eval "$(AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd env get-values)"
: "${AZURE_RESOURCE_GROUP:?Missing production resource group}"
: "${AZURE_CONTAINER_APP_NAME:?Missing production Container App name}"
test "${WEB_CONTAINER_APP_MODE:-}" = "existing"

AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent endpoint show \
  permit-readiness-agent --output json --no-prompt \
  > "artifacts/production/${evidence_prefix}-agent-route.json"
az containerapp ingress traffic show \
  --name "$AZURE_CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --output json \
  > "artifacts/production/${evidence_prefix}-app-traffic.json"

node scripts/ci/verify-release.mjs agent-route \
  "artifacts/production/${evidence_prefix}-agent-route.json" \
  "$stable_agent_version"
node scripts/ci/verify-release.mjs app-route \
  "artifacts/production/${evidence_prefix}-app-traffic.json" \
  "$stable_app_revision"
