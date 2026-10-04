# Customer demonstration walkthrough

## Purpose and guardrails

Use this walkthrough to demonstrate the reference journey with synthetic
information. State at the start and report review that the service is
unofficial, non-binding, and does not submit or approve permits. Do not enter
customer, personal, confidential, or precise real-world location data.

## Local setup

```powershell
corepack pnpm install
corepack pnpm --filter @permit-readiness/web dev
```

Open `http://localhost:3000`. The local journey needs no Azure credentials,
database, map key, or Foundry deployment. Without those dependencies it uses the
explicit local demo identity, process-memory repository, coordinate/GeoJSON
location fallback, and deterministic navigator adapter.

## Ten-minute applicant journey

1. **Landing:** point out the demonstration banner, non-binding language,
   privacy warning, and B.C. identity placeholder.
2. **Identity:** select **Start a demonstration project**, then **Continue as
   demo applicant**. Explain that production identity is a server-side adapter
   boundary and never falls back to demo identity.
3. **Create:** use a fictional name and select **Connectivity**.
4. **Intake:** answer the structured questions. Choose **Unknown** for the water
   question to show that uncertainty is retained rather than guessed.
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
