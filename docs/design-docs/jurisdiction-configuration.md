# Jurisdiction configuration model

## Status

Approved boundary design implemented by `@permit-readiness/contracts`,
`@permit-readiness/jurisdiction-config`, and the pure `@permit-readiness/domain`
rule engine.

## Purpose

Allow a public-sector team to adapt permitted identity, content, project types,
intake, illustrative rules, and guidance without forking application code or
granting configuration executable authority.

## Release model

A release is an immutable, reviewable bundle identified by:

- schema version;
- jurisdiction identifier;
- release version;
- publication state and effective date;
- content/rule/guidance version references; and
- integrity/provenance metadata.

Activation is environment-specific. Existing projects and reports remain pinned
to their selected release; activation never rewrites historical results.

## Configuration areas

- jurisdiction and service metadata;
- reference to an approved brand asset and theme identifier;
- enabled project types and feature flags;
- versioned intake question sets and conditional-display data;
- permit catalog, deterministic trigger-rule data, and dependencies;
- synthetic geographic demo zones;
- curated guidance-source manifest and evidence release;
- disclaimer, privacy, accessibility-help, and escalation content; and
- demo seed/reset metadata.

The bundle may select behavior supported by domain code. It may not provide
JavaScript, templates that execute code, arbitrary expressions, database
queries, secrets, credentials, unrestricted URLs, or instructions that replace
system/agent policy.

## Layering

1. A repository-owned base contract defines required safe behavior.
2. A jurisdiction release supplies approved values and supported options.
3. An environment activation selects one validated release and operational
   feature restrictions.
4. A project/readiness run pins the exact release identifiers used.

Environment variables contain deployment wiring and secrets, not product
content. Runtime configuration cannot weaken authorization, tenant isolation,
accessibility invariants, demonstration labelling, or non-binding language.

## Validation and activation

- Validate schema, references, uniqueness, rule graph integrity, supported
  feature values, URLs, content limits, locale, asset provenance, and theme
  accessibility before activation.
- Reject unknown executable fields and unresolved references.
- Require review evidence for brand assets and non-synthetic guidance.
- Run deterministic fixture and accessibility/theme checks before promotion.
- Activate atomically and retain the prior release for rollback.
- Fail closed if the selected release is absent or invalid; do not silently use
  another jurisdiction.

## Deterministic rule authoring

Permit rules use the closed condition vocabulary documented in
`packages/domain/README.md`; configuration cannot provide scripts or arbitrary
expressions. Rule IDs are unique within a release and every referenced permit,
question, zone, follow-up question, and guidance source must exist in that
release.

Priorities are integers. The highest applicable priority is authoritative.
Opposing outcomes at the same controlling priority are a disclosed conflict, not
an invitation to guess. Optional per-rule effective dates may narrow, but never
extend, the approved release window. Source IDs provide provenance, and
follow-up question IDs identify the exact intake prompts to ask when required
evidence is unknown.

The application constructs a `PermitRuleRelease` from the validated immutable
configuration and calls `evaluatePermitReadiness`. Agents receive the resulting
evidence and dispositions only; they do not execute or reinterpret rule data.

## Ownership

Jurisdiction content owners approve wording, rules, evidence, licensing, and
currency. Application owners maintain schema and safe behavior. Deployment
owners control environment activation. A configuration author cannot grant
roles, network access, or cloud permissions.

## Initial packs

- A generic public-sector pack.
- A B.C.-inspired pack for housing, electrification, and connectivity using
  original wording, synthetic records, synthetic geography, and only approved
  brand assets.

Neither pack is authoritative permit guidance by default.

## Evolution

Prefer additive schema changes. Breaking schema changes require a new schema
version, migration/compatibility tooling, updated fixtures, and explicit
activation. Reports always preserve the version they used.
