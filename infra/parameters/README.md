# Environment profiles

`dev.bicepparam` is cost conscious: scale-to-zero web compute, basic ACR and
Search, burstable PostgreSQL, locally redundant storage, and 30-day logs.

`prod.bicepparam` uses two minimum web replicas, multiple revisions, larger
PostgreSQL compute/storage and backup retention, standard Search with two
replicas, Premium ACR, zone-redundant storage, 90-day logs, and Key Vault purge
protection.

Both files read secrets from process environment variables and are intended for
explicit `az deployment sub what-if` review. Normal azd provisioning uses
`main.parameters.json`; `AZURE_ENV_PROFILE` selects the same defaults.

Both profiles require `WEB_CONTAINER_APP_MODE`. Use `existing` for updates so
the ARM deployment does not contain the Container App resource. Use `base` for
the first infrastructure pass before a web app exists. Use `bootstrap` exactly
once with an explicit `WEB_CONTAINER_IMAGE` and HTTPS
`AGENT_PERMIT_READINESS_AGENT_RESPONSES_ENDPOINT`; production additionally
requires an immutable image digest. Empty bootstrap values fail pre-provision
validation instead of creating a local-agent or sample-image revision.

Model capacity remains 10 in both profiles because quota and regional
availability must be confirmed per subscription. Change the deployment in root
`azure.yaml`, not only in Bicep, so the unified Foundry configuration remains
authoritative.
