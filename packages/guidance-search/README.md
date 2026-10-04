# Guidance search

This package owns the curated guidance manifest, deterministic ingestion, Azure
AI Search index contract, and safe retrieval adapter used by the hosted agent.
It does not provision Azure resources.

## Authentication

All Azure clients use `DefaultAzureCredential`. Do not add search admin/query
keys. The workload identity needs the minimum applicable Azure AI Search data
roles; an operator creating the index additionally needs index-management
permission.

## Manifests and corpus

- `corpus/generic-public-sector.manifest.json` contains synthetic original
  guidance.
- `corpus/bc-inspired-public.manifest.json` contains original concise summaries
  plus public B.C. source metadata and canonical URLs. It does not copy
  substantial source-page text.

Every source is HTTPS, usage-scoped, versioned, review-dated, effective-dated,
and hash verified before indexing. Remote source fetches are restricted to the
canonical URL host and redirects are rejected.

## Local validation

```powershell
pnpm guidance:local
```

The command defaults to the checked-in generic public-sector manifest. Set
`GUIDANCE_MANIFEST_PATH` and optionally pass a query after `--` to exercise
another reviewed manifest. Local mode is explicit and rejected when
`NODE_ENV=production`.

## Deployment initialization

Set `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, and the checked-in
deployment catalog path, then run:

```powershell
$env:GUIDANCE_CATALOG_PATH='packages\guidance-search\corpus\deployment-catalog.json'
pnpm guidance:initialize
```

The command creates or updates the index and synchronizes every approved,
version-pinned manifest in the catalog. It uses `DefaultAzureCredential`; in
GitHub Actions that resolves the Azure CLI session established by OIDC. Search
keys are not supported.

Refresh performs merge-or-upload first. Stale deletion starts only after all
uploads succeed and only when existing documents match the application owner,
manifest schema, jurisdiction, and an explicitly accepted release version.
Unknown or legacy ownership fails closed without uploading or deleting.

Set `FOUNDRY_PROJECT_ENDPOINT` and `FOUNDRY_EMBEDDING_MODEL` to generate vectors
through a configured embedding deployment. Without them, keyword/semantic
retrieval remains supported. `guidance:index` and `guidance:ingest` remain
operator-level commands; deployment workflows use `guidance:initialize`.

## Hosted agent

Use `GUIDANCE_SEARCH_MODE=azure` with the endpoint/index settings. Use
`GUIDANCE_SEARCH_MODE=local` plus a manifest path only for local demos/tests.
`disabled` returns explicit unavailable guidance; production never receives a
success-shaped in-memory fallback.
