# Initialization scripts

Required reference-data initialization lives in `packages/db/src/seed.ts` and is
exposed from the repository root as:

```powershell
pnpm db:initialize
```

It is idempotent and contains deterministic, versioned generic and B.C.-inspired
permit, rule, dependency, guidance, and spatial catalog data required by the
application.

Optional synthetic user, organization, and sample-project rows are isolated:

```powershell
$env:ALLOW_DEMO_DATA='true'
pnpm db:seed:demo
```

The approval variable is mandatory so production cannot receive demo rows by
accident.
