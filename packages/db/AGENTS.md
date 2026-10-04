# Database guidance

- Keep Drizzle schema, PostgreSQL/PostGIS migrations, seeds, and repository
  adapters in this package.
- Never modify an applied migration; add a new migration with upgrade tests.
- Require tenant/project ownership in service queries and reinforce it with
  database constraints where practical.
- Use explicit spatial reference systems and document geometry validity,
  transformation, and indexing choices.
- Keep immutable audit data append-only and avoid sensitive payloads by default.
- Domain services depend on repository interfaces, not Drizzle query details.
- Database tests must cover migrations, constraints, ownership isolation, and
  deterministic spatial fixtures.
