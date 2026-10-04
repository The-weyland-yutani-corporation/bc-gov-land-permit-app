# Jurisdiction configuration

Validated, immutable jurisdiction release bundles for metadata, permitted brand
references, project types, intake questions, permit and rule catalogs, synthetic
demo zones, guidance manifests, content, and feature flags.

Schema version `1.0.0` rejects unknown executable fields and unresolved
references. Approved releases require an effective date; rule and guidance
versions must match the release; permit dependencies must be known and acyclic.
Reports and projects pin the release reference rather than following activation
implicitly.

Two repository-owned examples are exported:

- `genericPublicSectorPreset`
- `bcInspiredSyntheticPreset`

Both use original wording, invented authorities, synthetic records, and
non-authoritative geography. Neither is official permit guidance.
