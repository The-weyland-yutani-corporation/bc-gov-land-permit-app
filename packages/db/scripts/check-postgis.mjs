import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required to verify the migrated database.');
}

const sql = postgres(connectionString, {
  max: 1,
  ssl:
    process.env.DATABASE_SSL_MODE === 'disable'
      ? false
      : (process.env.DATABASE_SSL_MODE ?? 'verify-full'),
});

try {
  const [result] = await sql`SELECT PostGIS_Version() AS version`;
  if (!result?.version) {
    throw new Error('PostGIS_Version() did not return a version.');
  }
  console.log(`PostGIS migration verification passed (${result.version}).`);
} finally {
  await sql.end();
}
