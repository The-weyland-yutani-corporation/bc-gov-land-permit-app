# Database

Drizzle ORM persistence for PostgreSQL 16 and PostGIS. The package owns schema,
migrations, required reference-data initialization, optional synthetic demo
data, environment validation, and tenant-scoped repository adapters.

## Local PostgreSQL and PostGIS

Copy the repository environment template and keep the resulting `.env` file
local:

```powershell
Copy-Item .env.example .env
```

One local option is the official PostGIS container image:

```powershell
docker run --name permit-readiness-postgis `
  -e POSTGRES_USER=permit_readiness `
  -e POSTGRES_PASSWORD=permit_readiness `
  -e POSTGRES_DB=permit_readiness `
  -p 5432:5432 `
  -d postgis/postgis:16-3.4
```

The default `.env.example` URL matches this container. Local connections disable
TLS explicitly; hosted environments should use `require` or `verify-full`.

## Migration and initialization workflow

Run commands from the repository root:

```powershell
pnpm db:check
pnpm db:migrate
pnpm db:initialize
```

`db:initialize` is the deployment-safe, idempotent command for versioned intake
questions, permit types, deterministic rules, dependencies, guidance metadata,
and synthetic spatial catalog entries. Run it after every migration and before
deploying code or sending traffic to a new revision.

Optional local/development demo identity, organization, and project data is a
separate command and is rejected without an explicit acknowledgement:

```powershell
$env:ALLOW_DEMO_DATA='true'
pnpm db:seed:demo
```

Production runs must leave demo data disabled unless the manual production
workflow input is explicitly selected and the protected environment approval is
granted. `pnpm db:seed` remains only as a compatibility alias for
`pnpm db:initialize`.

After changing `src/schema.ts`, generate a new migration and review it:

```powershell
pnpm db:generate
pnpm db:check
```

Never edit a migration after it has been applied to a shared environment. The
initial migration enables PostGIS and creates an append-only trigger for
`audit_events`; later changes must be additive migrations.

Reference data is idempotent and versioned. Spatial catalog entries use WGS 84 /
EPSG:4326 and are explicitly non-authoritative. Optional demo rows are
deterministic, synthetic, and never required in production.

## Repository authorization behavior

User-data repositories require both organization and project scope in their
queries. A failed membership check returns `FORBIDDEN`. Once organization scope
has been established, missing or cross-organization object identifiers return
`NOT_FOUND`, so object existence is not disclosed. Optimistic version failures
inside the authorized scope return `CONFLICT`.

Project creation, intake completion, and readiness-report persistence use single
database transactions. Geometry writes use typed EWKT at the Drizzle boundary,
while reads use `ST_AsGeoJSON` and contract validation.
