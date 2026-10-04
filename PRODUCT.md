# Product authority

## Status and authority

This document is the durable product authority for the Public-Sector Permit
Readiness Demo. Feature specifications may add acceptance criteria, but they
must not contradict the truths, constraints, or non-goals here. Visual tokens,
component anatomy, and page composition belong in `DESIGN.md`.

## Product definition

### Platform

A responsive web application and Azure-native reference implementation for
public-sector permitting journeys. It includes an applicant experience,
deterministic permit-readiness services, geospatial context, and one Microsoft
Foundry-hosted navigator.

### Primary users

- **Applicants** planning a land-based project who need to understand what
  information and authorizations may be relevant before contacting or applying
  to the responsible authorities.
- **Demo administrators and public-sector delivery teams** who select a
  versioned jurisdiction seed pack, reset synthetic demo data, and evaluate how
  the reference implementation could be adapted. A content-management product is
  not part of the first release.

### Applicant job and outcome

Applicants describe a project, locate it on a map, answer structured questions,
and receive a saved, reviewable readiness report. The report identifies likely
permits or authorizations, explains why they may apply, exposes assumptions and
missing information, suggests sequencing and next actions, and cites the
guidance used.

The report is preparation support only. It is not an application, approval,
legal opinion, eligibility determination, or statement by a regulator.

## Purpose and positioning

The product demonstrates a reusable pattern for combining deterministic public
service logic with a bounded conversational assistant. It is:

- a reference implementation, learning asset, and customer demonstration;
- inspired by the service journey and public-service character of Permit Connect
  B.C., while using original content and synthetic data;
- configurable for other jurisdictions without application-code forks; and
- intentionally task-oriented rather than a general chatbot or generic SaaS
  dashboard.

Unless an authorized deployment explicitly replaces the designation, every
surface must clearly identify the experience as a demonstration and not an
official government service.

## Operating context and core workflow

Applicants may not know the correct regulatory vocabulary, may be early in
project planning, and may provide incomplete or uncertain information. The
experience must therefore make progress possible while keeping uncertainty
visible.

The initial end-to-end workflow is:

1. Understand the service, privacy expectations, and non-binding limitation.
2. Sign in with Microsoft Entra External ID or use an explicit local demo mode.
3. Create a project and choose an enabled project type.
4. capture a point or polygon project location.
5. Complete a configurable, accessible intake.
6. Review the normalized project summary and correct information.
7. Ask the Permit Readiness Navigator for help.
8. Answer targeted follow-up questions for material gaps.
9. Review deterministic trigger results and curated guidance as an explained,
   cited readiness report.
10. Save the report and see resulting project tasks or status.

The detailed journey and acceptance criteria are in
[`docs/product-specs/applicant-journey.md`](docs/product-specs/applicant-journey.md).

## Product capabilities

The first release is expected to support:

- applicant registration/sign-in plus development-only local demo identity;
- jurisdiction-themed landing, project, intake, conversation, and report
  experiences;
- project creation for configured project types;
- point or polygon location capture using Azure Maps;
- dynamic intake questions and explicit incomplete/unknown answers;
- deterministic permit trigger, missing-information, and sequencing behavior;
- one applicant-facing Foundry-hosted Permit Readiness Navigator;
- grounded explanations backed by a curated, versioned guidance corpus;
- saved conversations, readiness reports, tasks, and basic project status;
- versioned jurisdiction configuration for metadata, brand references, project
  types, questions, permits, rules, demo geography, guidance manifests,
  disclaimers, escalation text, and feature flags;
- audit and operational telemetry that avoids raw sensitive intake content by
  default; and
- dev and production Azure environments with gated production promotion.

## Constraints and evidence limits

- Permit trigger results come from deterministic, versioned rules. The model may
  ask, organize, summarize, and explain; it is never the source of permit truth.
- Guidance must come from an approved, curated, versioned corpus and retain
  source metadata. A citation shows the evidence used, not that the result is
  legally complete or current.
- Conflicting, missing, stale, or unavailable evidence must be disclosed. The
  experience must not infer certainty from silence.
- Sample rules, permit catalogs, geographic zones, applicant records, project
  content, and guidance remain synthetic or clearly labelled illustrative unless
  ownership, authority, currency, and licensing are established.
- Production parcel/cadastre analysis is not available in the reference release.
  Map geometry and sample zones are demonstrations, not surveys or authoritative
  land records.
- Foundry hosted-agent capabilities may be preview services. Deployments must
  disclose preview dependencies and support replacement at the application
  boundary.
- Entra External ID may be administered outside the workload subscription or
  tenant and is treated as an external prerequisite.
- The browser never directly accesses Foundry, the database, or privileged
  search services.

## B.C. brand commitment

The default experience must read as a sober, content-first B.C. public service
rather than a generic AI product. It will follow the B.C. Design System and
applicable visual-identity guidance when implementing the B.C. theme.

Only a Government of British Columbia asset supplied by the user or otherwise
explicitly approved for this repository may be used. The BC Mark must not be
redrawn, recoloured, cropped, distorted, or separated. Asset provenance and
implementation-specific visual rules belong in `DESIGN.md`. Jurisdiction
identity must remain replaceable through validated configuration.

Visual similarity does not confer official status. The demonstration indicator
is mandatory unless the deployment is explicitly authorized as an official
service.

## Product principles

1. **Deterministic truth, assisted explanation.** Rules decide; the agent helps
   people understand and complete the process.
2. **Uncertainty is product information.** Missing answers, assumptions,
   evidence age, and confidence must be reviewable.
3. **Configuration over forks.** Jurisdiction variation uses validated,
   versioned configuration and content releases.
4. **Applicant control.** Users can review and correct inputs before generated
   guidance is saved or acted on.
5. **Least data necessary.** Collect, send, retain, and observe only what is
   required for the demonstrated job.
6. **Traceability over fluency.** A less polished answer with inspectable rules
   and citations is preferable to an unsupported confident answer.
7. **Progressive resilience.** Core project and intake work remains useful when
   the agent or a non-essential dependency is unavailable.
8. **Public-service clarity.** Use plain language, visible limitations, and
   clear routes to the responsible authority.

## Accessibility and inclusion

The product targets WCAG 2.2 AA across applicant journeys. Keyboard operation,
semantic structure, visible focus, accessible names and errors, sufficient
contrast, target size, zoom/reflow, and reduced-motion behavior are release
requirements rather than enhancements.

No task may require colour, pointer precision, hearing, animation, map
interaction, or conversation alone. Location capture needs a non-map
alternative; streaming content needs understandable announcements and controls;
plain-language content must define specialist terms. Accessibility must remain
intact when a jurisdiction theme or content pack changes.

## Explicit non-goals

The first release does not:

- submit, pay for, approve, deny, or track real permit applications;
- replace regulators, legal advice, professional due diligence, or direct
  confirmation with the responsible authority;
- integrate with BC Services Card, BCeID, production B.C. systems, or regulator
  case-management systems;
- perform authoritative parcel, title, cadastre, environmental, Indigenous
  rights, or legal-document analysis;
- provide document OCR, automated adjudication, or payment processing;
- provide regulator workflows, a general CMS, or unrestricted rule authoring;
- orchestrate multiple agents or allow an agent to mutate permit truth;
- copy proprietary content or inaccessible portal behavior;
- use unapproved government assets or present the demo as official; or
- promise that configuration alone makes a deployment legally or operationally
  ready for a new jurisdiction.

## Assumptions

- The initial product has one applicant journey and one agent.
- Organizations are the logical tenant boundary; a project belongs to one
  organization and uses one immutable jurisdiction-configuration version for a
  report run.
- Seed packs include a generic public-sector example and a B.C.-inspired sample
  for housing, electrification, and connectivity using original wording.
- Curated content owners are responsible for legal review, currency, licensing,
  and approval before illustrative material can become authoritative.
- Public-sector production adoption requires jurisdiction-specific privacy,
  threat, accessibility, records-management, legal, operational, and brand
  review beyond this repository.

## Success criteria

- An applicant can complete and understand the primary journey without
  specialist assistance.
- Every likely-permit recommendation can be traced to deterministic rule and
  evidence versions.
- The report makes missing information, assumptions, citations, limitations, and
  next actions explicit.
- Unauthorized users cannot access another organization's projects, reports, or
  conversations.
- Agent or search failure does not corrupt project data or masquerade as a
  completed assessment.
- A delivery team can adapt permitted brand, content, rules, and identity
  integration through documented boundaries rather than a code fork.
- Automated and manual accessibility validation supports the WCAG 2.2 AA target.
