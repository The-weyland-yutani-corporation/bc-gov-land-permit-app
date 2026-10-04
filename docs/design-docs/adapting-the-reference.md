# Adapting the reference implementation

## Safe adaptation boundary

Adapt a jurisdiction through a reviewed, immutable configuration release and
approved content—not an application-code fork. Configuration may select service
metadata, enabled project types, intake questions, permit metadata,
deterministic rules, synthetic zones, guidance manifests, disclaimers, feature
flags, and approved brand references.

Configuration cannot weaken authorization, tenant isolation, accessibility,
demonstration labelling, non-binding language, agent policy, or deterministic
rule authority. It cannot contain secrets, executable code, database queries, or
unrestricted remote assets.

## Adaptation sequence

1. **Establish ownership:** name product, legal/content, privacy, security,
   accessibility, operations, and brand approvers.
2. **Create a release:** add a new validated preset or loader input in
   `packages/jurisdiction-config`; use new jurisdiction, release, rule, content,
   and guidance versions.
3. **Author deterministic behavior:** use only the closed rule vocabulary in
   `packages/domain/README.md`. Test unknowns, conflicts, effective dates,
   dependencies, cycles, and spatial evidence.
4. **Curate guidance:** add HTTPS, hash-verified, licensed sources through the
   `packages/guidance-search` manifest contract. Review currency and
   instruction-like content before ingestion.
5. **Replace the theme:** override semantic tokens rather than component
   structure. Preserve contrast, focus, target sizes, reflow, reduced motion,
   alert meanings, and the visible demo designation.
6. **Add approved identity assets:** follow `DESIGN.md` and
   `apps/web/public/brand/README.md`. Never redraw or approximate a government
   mark. Install approved fonts using `apps/web/public/fonts/README.md`.
7. **Integrate identity and maps:** keep credentials and privileged calls on the
   server. Preserve local demo mode as development-only and keep the non-map
   location method.
8. **Evaluate and promote:** add representative contract, rule, search, agent,
   accessibility, desktop/mobile, and end-to-end cases. Pin every promoted
   configuration, rule, guidance, model, and agent version.

## Required validation

```powershell
corepack pnpm validate
corepack pnpm db:check
corepack pnpm guidance:local
corepack pnpm --filter @permit-readiness/agent eval:preflight
corepack pnpm infra:validate
corepack pnpm --filter @permit-readiness/web test:e2e
```

For a production candidate, also complete jurisdiction-specific legal, privacy,
threat, records-management, accessibility, content, brand, operational, quota,
cost, and disaster-recovery review. Configuration alone does not make a
deployment authoritative or production-ready.

## Theme replacement acceptance checklist

- The demo banner remains until the deployment itself is formally authorized.
- The approved asset has recorded source, approver, date, conditions, accessible
  name, clear space, and minimum size.
- All text and non-text contrast passes WCAG 2.2 AA checks.
- Keyboard order, visible focus, 320 CSS px reflow, 200%/400% zoom, reduced
  motion, and forced colours remain usable.
- Landing, intake, navigator, report, errors, empty, loading, permission, and
  degraded states use the same semantic anatomy.
- Reports retain exact configuration, rule, guidance, agent, and evidence
  versions and continue to state their non-binding limits.
