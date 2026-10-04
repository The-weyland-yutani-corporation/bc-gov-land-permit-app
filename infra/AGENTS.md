# Infrastructure guidance

- This directory owns the root `azure.yaml` deployment graph, ejected Bicep,
  environment parameters, managed identities, RBAC, and Azure resource wiring
  when the infrastructure task begins.
- Use `azd` plus reviewed Bicep as the source of truth; do not normalize manual
  portal drift.
- Keep dev and production parameter files explicit. Never commit secrets,
  subscription identifiers, generated cloud state, or local environment values.
- Prefer managed identity and least-privilege role assignments. GitHub Actions
  must use OIDC rather than long-lived Azure credentials.
- Validate Bicep and the deployment graph before provisioning. Infrastructure
  changes must document migration, cost, security, and rollback effects.
- Do not add placeholder resources that appear deployable before their dedicated
  implementation and validation task.
