#!/usr/bin/env bash
set -euo pipefail

config="$1"
results="$2"
profile="$3"
baseline="${4:-}"
agent_version="${5:-}"
candidate_sha="$(git rev-parse HEAD)"
run_config="$config"
candidate_config=""

mkdir -p "$(dirname "$results")"
if [[ -n "$agent_version" ]]; then
  candidate_config="${config%.yaml}.candidate.yaml"
  node scripts/ci/pin-eval-agent-version.mjs \
    "$config" "$candidate_config" "$agent_version"
  run_config="$candidate_config"
  trap 'rm -f "$candidate_config"' EXIT
fi
AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent eval run \
  --config "$run_config" \
  --name "${profile}-${candidate_sha}" \
  --no-prompt
AZURE_DEV_USER_AGENT=microsoft_foundry_skill azd ai agent eval show \
  --out-file "$results" \
  --no-prompt

if [[ -n "$agent_version" ]]; then
  node scripts/ci/verify-release.mjs eval "$results" "$agent_version"
fi

gate=(pnpm --filter @permit-readiness/agent eval:check -- \
  --results "$results" --profile "$profile")
if [[ -n "$baseline" ]]; then
  gate+=(--baseline "$baseline" --require-baseline)
fi
"${gate[@]}"

if [[ "$profile" == "regression" ]]; then
  mkdir -p artifacts/production
  cp "$results" artifacts/production/baseline.json
  if [[ -n "$candidate_config" ]]; then
    cp "$candidate_config" artifacts/production/candidate-eval.yaml
  fi
fi
