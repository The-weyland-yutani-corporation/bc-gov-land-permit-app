# Applicant permit-readiness journey

## Status

Approved initial product specification. Root `PRODUCT.md` remains authoritative
for product truth and non-goals.

## Goal

Help an applicant turn an early, possibly incomplete project idea into a
reviewable, non-binding permit-readiness report without implying that a permit
has been identified conclusively or an application has been submitted.

## Preconditions

- A validated jurisdiction release and synthetic seed pack are active.
- The applicant can use Entra External ID, or local demo mode is explicitly
  enabled in a non-production environment.
- Required dependencies disclose degraded states rather than silently
  substituting data.

## Journey

1. **Orient:** The landing page explains the service, expected information,
   privacy, accessibility help, demonstration status, and non-binding scope.
2. **Identify:** The applicant signs in and selects an available organization
   context; local demo users see a persistent demo designation.
3. **Create:** The applicant creates a named project and selects an enabled
   project type.
4. **Locate:** The applicant draws a point or polygon or uses an equivalent
   non-map method. The review shows the captured representation and limitations.
5. **Describe:** A versioned question set adapts to prior answers. Required,
   optional, unknown, and not-applicable states are distinguishable.
6. **Review:** The applicant sees normalized project facts, gaps, configuration
   version, and can correct answers before requesting guidance.
7. **Navigate:** The navigator receives only authorized, minimized context and
   asks targeted questions for gaps that can materially change the result.
8. **Evaluate:** Deterministic services evaluate triggers, missing information,
   configured demo geography, and permit dependencies.
9. **Report:** The applicant reviews likely authorizations, deterministic
   reasons, assumptions, uncertainty, missing information, sequence, approved
   citations, next actions, and the non-binding disclaimer.
10. **Continue:** An accepted report is saved as an immutable snapshot and
    creates traceable project tasks/status. The applicant can revisit inputs and
    intentionally start a new versioned assessment.

## Acceptance criteria

- A keyboard-only user can complete every required task, including a non-map
  location path, with visible focus and understandable errors.
- Progress survives validation errors and recoverable dependency failures.
- An applicant can answer "unknown" where the product permits uncertainty; the
  report carries that gap rather than inventing a value.
- The project summary is editable before a readiness run.
- The server verifies tenant/project access before each read, write, agent
  invocation, report save, and retry.
- The agent cannot mark intake complete, add a permit, change a rule result, or
  persist a report outside deterministic validated operations.
- Every recommendation identifies the applicable rule/configuration release and
  approved evidence when evidence is available.
- No evidence or conflicting evidence is an explicit report state.
- Interrupted or failed agent runs are distinguishable from completed reports
  and do not create duplicate tasks on retry.
- Saved reports retain their input, rules, evidence, configuration, and agent
  version metadata even after later releases activate.
- Demonstration status and non-binding guidance remain visible at orientation
  and in the report.

## Edge and degraded cases

- Authentication expiry preserves safe local form state and requires
  re-authentication before server mutation.
- Map failure offers the non-map path and suppresses unsupported spatial
  conclusions.
- Agent/search failure leaves deterministic project and intake capabilities
  usable and explains what could not be completed.
- A configuration change during intake does not silently alter the assessment;
  the user finishes on the pinned version or explicitly restarts.
- Conflicting answers are surfaced for correction or retained as an explicit
  unresolved assumption.
- Another tenant's guessed project/report identifier returns no protected
  content.

## Evidence and content limits

All initial people, projects, rules, geographic zones, permit records, and
guidance are synthetic or illustrative. Citations demonstrate provenance and
grounding mechanics; they do not make the report legally complete or current.

## Out of scope

Real application submission, payment, regulator review, authoritative parcel
analysis, document adjudication, and binding permit or legal decisions.
