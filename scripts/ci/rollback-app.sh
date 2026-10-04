#!/usr/bin/env bash
set -euo pipefail

revision="$1"
eval "$(AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd env get-values)"
az containerapp ingress traffic set \
  --name "$AZURE_CONTAINER_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --revision-weight "${revision}=100"
