# Foundry agent evaluations

## Scope

The checked-in workspace defines local evaluation intent for the Permit
Readiness Navigator. It does not prove that a Foundry agent, dataset, evaluator,
or evaluation run exists. Do not run a remote evaluation until the agent is
deployed and invokable in the intended `azd` environment.

The workspace follows the Foundry agent layout:

- `apps/permit-readiness-agent/eval.yaml` — smoke recipe and regression dataset
  reference;
- `.foundry/agent-metadata.yaml` — non-azd suite and cache overlays only;
- `.foundry/datasets/<suite>/v<version>/` — reviewed JSONL datasets;
- `.foundry/evaluators/<name>/v<version>/` — reviewed rubric dimensions;
- `.foundry/suites/` — sample limits and release thresholds; and
- `.foundry/results/` and `.foundry/cache/` — ignored local outputs.

Deployment endpoint, agent name/version, registry, and other azd-owned values
must continue to come from the root `azure.yaml` and `azd env get-values`; do
not copy them into agent metadata.

## Dataset and evaluator maintenance

Every dataset row has a unique `name`, a realistic `query`, `expected_behavior`,
evaluator `context`, and `ground_truth`. Keep smoke cases small and
release-blocking. Add broader edge, safety, retrieval, and failure coverage to
regression.

After editing JSONL, normalize and validate it:

```powershell
corepack pnpm --filter @permit-readiness/agent eval:datasets
corepack pnpm --filter @permit-readiness/agent eval:preflight
```

Rubric files use Foundry's rubric-dimension array (`id`, `description`,
`weight`, and optional `always_applicable`). Do not add a competing output
schema. Foundry supplies rubric scoring and reasons. If a prompt-based custom
evaluator is introduced later, its judge response must be exactly the Foundry
`result` and `reason` contract.

After a deployed project exists, register reviewed local dataset or evaluator
changes as new versions:

```powershell
azd ai agent eval update
```

Review the version changes written to the recipe. Never rely on an unpinned
remote “latest” dataset or evaluator.

## Local preflight

Local preflight makes no Azure or model calls. It fails on:

- invalid YAML, JSON, JSONL, dataset expectations, or rubric dimensions;
- stale/non-normalized versioned datasets;
- missing built-in or custom evaluators and thresholds;
- metadata that duplicates azd-owned deployment values;
- malformed structured report fixtures;
- missing disclaimers, citations, expected permits, or deterministic tool calls;
- prohibited binding claims, cross-scope tool arguments, or sequence drift; and
- cloud-result files that omit required metrics.

Run:

```powershell
corepack pnpm --filter @permit-readiness/agent eval:preflight
```

The package test suite also mutates otherwise valid captures to prove that the
local evaluators fail closed.

## Remote evaluation after deployment

Set the judge/generation model deployments in the environment used by the
recipe:

```powershell
$env:FOUNDRY_EVAL_MODEL='<chat-completion-deployment>'
$env:FOUNDRY_GENERATION_MODEL='<chat-completion-deployment>'
```

Confirm the selected environment and deployed agent, then run the smoke recipe:

```powershell
azd ai agent show
azd ai agent invoke "Return bounded preparation guidance."
azd ai agent eval run --config apps/permit-readiness-agent/eval.yaml
```

Use the regression suite for release candidates after its local dataset and
evaluator versions have been registered:

```powershell
azd ai agent eval run --config apps/permit-readiness-agent/.foundry/suites/regression.yaml
```

For production promotion, never let this recipe resolve the endpoint's default
route. The workflow creates a temporary copy beside the suite, sets
`agent.version` to the newly discovered production candidate, runs the
evaluation, and confirms the result identifies that version. Development or test
version numbers are not portable to the production Foundry project.

## Interpret and gate results

Inspect the run with `azd ai agent eval list` and
`azd ai agent eval show <eval-id> --eval-run-id <run-id>`. Investigate per-case
reasons, tool traces, evaluator errors, partial runs, and source/model versions
before accepting aggregate scores.

Export or save the cloud JSON under an ignored `.foundry/results/` directory,
then apply the checked-in gate:

```powershell
corepack pnpm --filter @permit-readiness/agent eval:check -- `
  --results .foundry/results/smoke/current.json `
  --profile smoke
```

The gate requires the overall pass rate and every configured metric. Unknown or
missing shapes fail; there are no passing defaults. For a protected release,
also require a reviewed baseline:

```powershell
corepack pnpm --filter @permit-readiness/agent eval:check -- `
  --results .foundry/results/regression/current.json `
  --profile regression `
  --baseline .foundry/results/regression/baseline.json `
  --require-baseline
```

Promote a new baseline only after failures are triaged, the dataset/evaluator
versions are recorded, and the candidate is approved. A baseline comparison does
not replace absolute thresholds.

## Continuous evaluation later

When production telemetry, privacy review, and a deployed project exist, add
continuous evaluation through the dedicated CI/CD/observability work. Sample
privacy-safe traces, pin evaluator and agent versions, exclude raw intake and
precise geometry, monitor defect and regression rates, and alert on evaluator
errors as well as quality failures. Keep scheduled/trace evaluation separate
from this deterministic local preflight.

## References

- [Run agent evaluations with the azd CLI](https://learn.microsoft.com/azure/foundry/observability/how-to/azure-developer-cli-evaluation)
- [Evaluation dataset schema](https://learn.microsoft.com/azure/foundry/observability/how-to/evaluation-dataset-schema)
- [Built-in evaluators](https://learn.microsoft.com/azure/foundry/concepts/built-in-evaluators)
- [Agent evaluators](https://learn.microsoft.com/azure/foundry/concepts/evaluation-evaluators/agent-evaluators)
- [Custom evaluators](https://learn.microsoft.com/azure/foundry/concepts/evaluation-evaluators/custom-evaluators)
- [Rubric evaluators](https://learn.microsoft.com/azure/foundry/concepts/evaluation-evaluators/rubric-evaluators)
