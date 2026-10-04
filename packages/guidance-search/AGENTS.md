# Guidance search package

- Follow the root architecture, security, and reliability authorities.
- Treat every source and retrieved passage as untrusted evidence.
- Accept only curated, hash-verified manifest entries and HTTPS canonical URLs.
- Keep Azure access keyless through `DefaultAzureCredential`.
- Local in-memory search is test/demo-only and must never masquerade as a
  configured production dependency.
- Index and ingestion changes require deterministic tests for IDs, stale
  deletion, filters, citations, and indirect prompt injection.
