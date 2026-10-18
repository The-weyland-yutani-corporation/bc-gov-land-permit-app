# Customer demonstration walkthrough

## Purpose and guardrails

Use this walkthrough to demonstrate the reference journey with synthetic
information. State at the start and report review that the service is
unofficial, non-binding, and does not submit or approve permits. Do not enter
customer, personal, confidential, or precise real-world location data.

## Readiness summary

| Item               | Assessment                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| Build              | Permit Readiness Navigator                                               |
| Repository         | https://github.com/The-weyland-yutani-corporation/bc-gov-land-permit-app |
| Target             | Reusable public-sector reference; no confirmed government engagement     |
| Industry           | Government / public-sector permitting                                    |
| Business persona   | Public-service product owner; applicant is the end user                  |
| Technical audience | SE/CSA, application architect, delivery team                             |
| Target readiness   | Catalog-ready                                                            |
| Current stage      | Demo-ready candidate; not catalog accepted or production approved        |
| Live demo          | No deployed URL verified                                                 |

Top three sharing gates: reproduce the journey and evidence; complete the
customer handoff; obtain license, maintainer, private-reporting, and
catalog-schema approvals. See [the evidence record](../assets/evidence.yaml) for
actual results, not inferred success from the existence of tests.

Current verification: both browser journeys, the build, formatting, lint, types,
evaluation preflight, and handoff checks passed. Full `pnpm validate` remains
blocked by a cancelled nested subtest in the unchanged guidance-search suite.
This failure is recorded, not suppressed or represented as a passing gate.

## Local setup and reset

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @permit-readiness/web dev
```

Open `http://localhost:3000`. The local journey needs no Azure credentials,
database, map key, or Foundry deployment. Without those dependencies it uses the
explicit local demo identity, process-memory repository, coordinate/GeoJSON
location fallback, and deterministic navigator adapter.

Use Node.js 22 and the pinned pnpm version through Corepack. Do not copy
`.env.example` for this minimum path: its `DATABASE_URL` selects PostgreSQL.
Check the shell and `apps/web/.env*` files for inherited settings. For the
credential-free path, leave `DATABASE_URL` unset and use `APP_ENV=local`,
`AUTH_MODE=local-demo`, and `PERMIT_AGENT_MODE=local` (the local defaults). Do
not change deployed environment settings to make a local demo work. The first
build creates shared-package outputs; installation alone does not build the
database package. The build needs no cloud credentials.

**Reset:** stop and restart the web server process to clear the in-memory
repository. Signing out or opening another browser is not a server-data reset.
Do not rely on development hot reload to reset state. Database initialization
and demo seeding are idempotent, not purge/reset commands; never drop a shared
database to rehearse a demo.

If dependency installation fails, record the registry/network error and stop. Do
not change dependency versions or claim a runtime pass to work around setup.

## Canonical end-to-end journey

Initial request: “I am planning a communications corridor. What should I prepare
before contacting the authorities?”

1. **Landing:** point out the demonstration banner, non-binding language,
   privacy warning, and B.C. identity placeholder.
2. **Identity:** select **Start a demonstration project**, then **Continue as
   demo applicant**. Explain that production identity is a server-side adapter
   boundary and never falls back to demo identity.
3. **Create:** use a fictional name and select **Connectivity**.
4. **Intake:** managed land **Yes**, water **Unknown**, road-access changes
   **No**, linear utility/communications corridor **Yes**. Uncertainty must
   remain visible rather than guessed.
5. **Location fallback:** when Azure Maps is unavailable, enter `-123.3656`,
   `48.4284`, plus a general synthetic description. Explain that the location is
   not a survey or parcel analysis.
6. **Summary:** review normalized facts and the explicit unknown. Correct an
   answer if useful.
7. **Navigator:** ask “What should I prepare about water and location?” Point
   out that the navigator explains saved facts but cannot decide requirements.
8. **Report:** generate the readiness report. Review the degraded status,
   missing information, deterministic possible requirements, rule references,
   assumptions, sequence, illustrative citations, limitation, and release
   metadata.
9. **Tasks:** open **Tasks**, mark one task complete, and explain that tasks
   come from the accepted report rather than model prose alone.

Useful outcome: a reviewable preparation report, not a permitting decision. Next
action: resolve the water information gap and confirm current requirements with
the responsible authority. Correct saved project facts and reassess where
appropriate; task completion never means a permit has been approved.

### Expected checkpoints

- Landing: “Demonstration — not an official government service.”
- Summary: “Some required information is unknown.”
- Navigator: cannot decide which permits legally apply.
- Report: “Report completed with information gaps,” illustrative sources,
  limitations, deterministic reasons, and release metadata.
- Tasks: a derived preparation task can be marked complete.

Do not promise a fixed permit count: outcomes depend on the pinned release and
location. The scenario matches `apps/web/tests/e2e/smoke.spec.ts`.

## Five-minute demo

| Time      | Action                                           | Talk track                                               |
| --------- | ------------------------------------------------ | -------------------------------------------------------- |
| 0:00–0:40 | Landing and disclaimer                           | Preparation support, not an official decision            |
| 0:40–1:30 | Demo identity and fictional connectivity project | Start with the applicant's task, not chat                |
| 1:30–2:20 | Canonical intake and location fallback           | Unknown information remains visible                      |
| 2:20–3:00 | Summary and navigator question                   | Rules decide; the assistant explains                     |
| 3:00–4:20 | Generate and inspect report                      | Show reasons, gaps, sources, provenance, and limitations |
| 4:20–5:00 | Complete one task and offer workshop             | Better-prepared enquiries are the value hypothesis       |

Rehearse after setup. If using a prepared project, disclose that it is preloaded
synthetic data. The automated recording is a shorter visual aid, not evidence
that a human has rehearsed this five-minute presentation.

## Fifteen-minute demo

| Time        | Action                                                   |
| ----------- | -------------------------------------------------------- |
| 0:00–2:00   | Customer problem, applicant persona, and boundaries      |
| 2:00–6:00   | Project creation, canonical intake, location, and review |
| 6:00–9:00   | Navigator, report, sources, provenance, and tasks        |
| 9:00–11:00  | Local/cloud distinction, recovery, and information gaps  |
| 11:00–13:00 | Architecture and versioned jurisdiction adaptation       |
| 13:00–15:00 | Discovery questions, bounded pilot, and next-step CTA    |

Describe cloud behavior as demonstrated only after the authorized environment
has actually been exercised. Never substitute local fixtures for cloud results.

## Evidence and assets

The machine-readable [evidence record](../assets/evidence.yaml) distinguishes
executed checks, blocked checks, source revision, and pending external
approvals. The [architecture image](../assets/architecture.svg) is a simplified
rendering of the root architecture, not a deployment inventory.

Capture only synthetic information. Keep demonstration labels visible; review
screens, videos, captions, traces, and browser chrome for sensitive data. Use
landing as the catalog thumbnail, plus intake (Unknown), location fallback,
report, tasks, and mobile report screenshots. Add descriptive alt text wherever
images are embedded.

### Reproduce screenshots and a captioned recording

After installing dependencies and the existing Playwright Chromium prerequisite,
run the existing smoke test with opt-in asset capture:

```sh
PERMIT_CAPTURE_ASSETS=true corepack pnpm --filter @permit-readiness/web test:e2e
```

This POSIX-shell example adds screenshots, captions, transcript, and video to
the ignored `apps/web/test-results` output. It does not publish them or send
anything to Azure. On PowerShell, set `$env:PERMIT_CAPTURE_ASSETS='true'` before
running the same package command.

Use an isolated local shell with the defaults above and no previously running
web server. Review the successful desktop outputs before copying them into
`docs/assets` as `landing.png`, `intake.png`, `location.png`, `report.png`,
`tasks.png`, `walkthrough.webm`, `walkthrough.vtt`, and `walkthrough.txt`. Copy
the successful mobile report as `mobile-report.png`. Playwright's video is named
`video.webm` in the test output; rename only the reviewed desktop copy. Record
the source commit, artifact hashes, and results in `evidence.yaml`. Do not
publish recordings from failed tests as successful demonstrations.

The short silent recording uses descriptive captions and a matching transcript.
A human-narrated five-minute recording remains a separate publication task. Do
not mark media as available in `accelerator.yaml` until the files exist.

### Demo acceptance

- A second SE/CSA can run the local path without the author.
- A rehearsed presenter completes the journey within five minutes after setup.
- Unknowns remain unknown; sources and next actions are inspectable.
- Task completion never implies approval.
- Desktop/mobile layout and keyboard behavior support the full journey.
- Manual accessibility review supplements automated smoke coverage.
- Local evidence is not advertised as live Azure evidence.

## Customer engagement

**Account-team opener:** “Could we walk through how an applicant prepares for a
land-based project today? This reference shows how structured intake,
explainable rules, and a bounded AI assistant could help applicants arrive
better prepared—without automating regulatory decisions.”

### Discovery questions

1. Where do applicants stop or ask for clarification?
2. Which missing facts create repeated work?
3. Which requirements can be expressed deterministically?
4. Who owns and approves the rules and guidance?
5. Which questions require human judgment or escalation?
6. What information must not enter an AI service?
7. Which accessibility, language, identity, and retention obligations apply?
8. What baseline would demonstrate improved applicant preparation?

### Workshop and pilot brief template

Complete these fields with the customer; do not treat this template as approval:

| Field              | Workshop/pilot decision                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Sponsor and owners | Name product, content/legal, privacy, security, accessibility, and operations owners          |
| Scope              | One project type, one jurisdiction, approved guidance, synthetic or explicitly approved cases |
| Current journey    | Identify handoffs, recurring missing information, and clarification baseline                  |
| Decision boundary  | List deterministic rules, explanatory assistance, and human-only decisions                    |
| Evidence           | Approve sources, versions, expected outcomes, and representative test cases                   |
| Measures           | Compare preparation quality and clarification effort against the agreed baseline              |
| Acceptance         | Match approved rule results; reject unsupported/binding claims; trace recommendations         |
| Exit               | Record evaluation results, operating responsibilities, and go/no-go recommendation            |

Success requires all agreed trigger cases to match deterministic expectations,
every recommendation to have provenance, applicants to identify the next action,
and required reviews to be completed. Agree quantitative improvement targets
with the customer; do not invent approval-speed or cost-saving claims.

**CTA:** “Bring one representative project type, its intake questions, approved
guidance, and a service/content owner. We will map a bounded pilot and agree how
to measure better-prepared enquiries.”

## Publication checklist

- [x] README value story, local/cloud distinction, setup, limitations, and CTA.
- [x] Architecture authority plus accessible local/cloud rendering.
- [x] Canonical synthetic scenario and 5-/15-minute demo scripts.
- [x] Adaptation and deployment prerequisites, cost drivers, and recovery
      guidance.
- [x] Draft accelerator metadata, explicitly not a verified catalog schema.
- [x] CI includes root Markdown and accelerator metadata changes.
- [ ] Clean-install validation and browser results recorded as passing.
- [x] Synthetic desktop/mobile screenshots, captions, transcript, and local
      video captured.
- [ ] Human-narrated five-minute demo rehearsed and recorded.
- [ ] Independent SE/CSA setup and adaptation handoff completed.
- [ ] Manual WCAG 2.2 AA journey review completed; record scope and findings.
- [ ] Security/dependency/history/artifact review approved; findings resolved.
- [ ] Rights holder approves root license and third-party content/asset notices.
- [ ] Maintainers accept ownership and support scope; private reporting
      confirmed.
- [ ] Catalog access, metadata schema/taxonomy, and submission procedure
      verified.
- [ ] Authorized cloud deployment, pinned evaluation, costs, and rollback
      evidenced.
- [ ] Release commit/tag and all asset hashes recorded; catalog submission
      approved.

The local dependency audit reports 12 existing advisories (4 high, 6 moderate, 2
low). Package versions were preserved while normalizing lockfile registry
metadata. Triage and remediation are required before security sign-off; these
are not CodeQL alerts or newly introduced dependencies.

On 2026-10-18, the supplied catalog repository
`https://github.com/mcaps-microsoft/accelerators-catalog` returned 404 through
GitHub access. A 404 does not establish whether it is private, renamed, or
absent. Obtain access and validate the real schema before submission. Do not
pick a license, assign maintainers, or claim cloud approval on another owner's
behalf.

## Demonstration recovery

- **Map unavailable:** continue with coordinates or GeoJSON.
- **Navigator unavailable:** structured intake and deterministic project work
  remain saved; retry later.
- **Search unavailable:** do not claim grounded guidance is complete; use the
  responsible-authority escalation.
- **Form error:** retain the entered values, correct the named field, and retry.
- **Cloud demo unavailable:** use the local path above. Do not enable local demo
  identity in production.

## Before a customer session

Run:

```powershell
corepack pnpm validate
corepack pnpm --filter @permit-readiness/agent eval:preflight
corepack pnpm --filter @permit-readiness/web test:e2e
```

Confirm the viewport at desktop and mobile widths, keyboard focus order, demo
banner, brand placeholder, and the report limitation. If showing Azure-hosted
components, separately confirm the authorized environment, deployed agent
version, synthetic evaluation case, cost approval, and rollback target.
