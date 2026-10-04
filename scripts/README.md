# Repository scripts

- `validation/` contains scaffold and repository checks used by canonical
  commands.
- `infra/` validates azd environment contracts and synchronizes deployment
  outputs.
- `ci/` captures, verifies, pins, and restores immutable release routes. The
  production workflow uses `verify-stable-routes.sh` immediately after optional
  provisioning.
- `seed/` is reserved for deterministic seed workflows added by later tasks.

Scripts must be non-interactive in CI, avoid embedded secrets, and document any
external side effects.
