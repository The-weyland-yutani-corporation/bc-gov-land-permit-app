# Contract guidance

- Cross-workspace API, agent-tool, event, and structured-output shapes start
  here.
- Prefer additive, backward-compatible schema changes and explicit versioning.
- Do not place database models, UI state, framework request objects, or business
  orchestration in transport contracts.
- Breaking changes require rationale, migration notes, compatibility tests, and
  updates to every consumer in the same change.
- Validate untrusted inputs and keep error shapes safe for external callers.
- Generated artifacts must be reproducible and must not replace the authored
  source schemas.
