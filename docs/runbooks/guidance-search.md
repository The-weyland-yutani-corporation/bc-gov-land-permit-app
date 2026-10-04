# Guidance search index and refresh

## Scope

This runbook creates or updates the expected Azure AI Search index and refreshes
documents from the approved versioned deployment catalog.

## Preconditions

- Review the manifest, concise summaries, canonical URLs, licensing metadata,
  hashes, effective dates, and next-review dates.
- Grant only the required Azure AI Search data/index-management roles.
- Set `AZURE_SEARCH_ENDPOINT`, `AZURE_SEARCH_INDEX_NAME`, and
  `GUIDANCE_CATALOG_PATH`.
- For vectors, also set `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_EMBEDDING_MODEL`,
  and matching `GUIDANCE_VECTOR_DIMENSIONS`.

No search or model API key is supported.

## Validate locally

```powershell
$env:GUIDANCE_MANIFEST_PATH='packages\guidance-search\corpus\bc-inspired-public.manifest.json'
pnpm guidance:local -- "road access"
pnpm --filter @permit-readiness/guidance-search test
```

## Initialize the deployment catalog

```powershell
$env:GUIDANCE_CATALOG_PATH='packages\guidance-search\corpus\deployment-catalog.json'
pnpm guidance:initialize
```

The command uses managed identity through `DefaultAzureCredential`, creates or
updates the schema, then normalizes, hash-validates, chunks, sanitizes,
identifies, and optionally embeds each approved manifest. It merge-or-uploads
before deleting stale documents. Upload failures prevent deletion. Existing
documents must match the catalog owner, manifest schema, jurisdiction, and an
accepted release version; otherwise the command fails closed without mutation.

## Verify

Confirm that searches return only the intended jurisdiction, project type, and
approved source IDs; citations use canonical URLs and bounded excerpts; stale or
unreviewed evidence is excluded; prompt-injection flags are visible; and
no-results or unavailable states are explicit.

## Rollback

Restore the prior immutable catalog and manifests, include both current and
prior versions in `acceptedExistingReleaseVersions`, and rerun initialization.
Document IDs include source version and content hash, so stale deletion occurs
only after the prior set uploads successfully.
