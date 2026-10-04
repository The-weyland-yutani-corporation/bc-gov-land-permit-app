# Domain

Framework-independent domain models and deterministic helpers for project
status, intake completeness, permit conditions, dependency integrity, and
jurisdiction release references.

This package has no Zod, HTTP, database, UI, or agent dependency. Transport
validation belongs in `@permit-readiness/contracts`; configuration parsing
belongs in `@permit-readiness/jurisdiction-config`.

## Permit reasoning API

`evaluatePermitReadiness` is the authoritative pure reasoning entry point. It
accepts an explicitly selected rule release, permit catalog, project type,
intake evidence, optional point/polygon geometry or precomputed spatial signals,
and dependencies. It returns:

- `likely`, `not_indicated`, or `needs_information` per permit;
- matched and considered rule IDs, reasons, assumptions, and source IDs;
- leaf-level evidence with the actual and expected values;
- required and missing fields plus targeted follow-up question IDs;
- deterministic evidence completeness, never a model probability;
- conflict, contradiction, stale-configuration, and escalation flags; and
- a stable dependency plan with blocking prerequisites, parallel work groups,
  external blockers, and cycles.

`selectPermitRuleRelease`, `sequencePermits`, and the spatial intersection
helpers are separately exported for web handlers and bounded agent tools. Inputs
are never mutated, and output ordering is stable.

## Deterministic and agent boundary

Rules, release selection, spatial matching, missing-information detection,
confidence/completeness, and permit sequencing belong here. An agent may ask the
returned follow-up questions or explain the returned evidence, but it must not
add permits, change dispositions, manufacture citations, resolve conflicts, or
replace a `needs_information` result with a stronger conclusion.

## Rule authoring

Rules are data, not executable expressions. Authors use the closed
`PermitCondition` union:

- project type membership;
- answer comparison (`equals`, `not_equals`, `includes`, and numeric
  comparisons);
- location presence or intersection with configured zone IDs; and
- `all`, `any`, and `not` boolean composition.

Every rule identifies its permit, release version, outcome, explanation, and
condition. Authors should also provide an integer priority, source IDs,
effective dates when narrower than the release, follow-up question IDs for
spatial or compound gaps, and `requiresEscalation` when authority confirmation
is always appropriate. Higher priority rules control lower priority rules.
Opposing matched rules at the same controlling priority produce
`needs_information`; silence or absent spatial evidence never proves that a
permit is unnecessary.

Rule releases must be approved and effective on the evaluation date. A pinned
missing, draft, retired, future, stale, internally mis-versioned, or
unknown-permit release fails closed as `invalid_configuration`.

The exported generic and B.C.-inspired fixtures are original synthetic data.
They exercise housing, electrification, connectivity, land, water, riparian,
wildlife, access, point, and polygon scenarios and are not official guidance.
