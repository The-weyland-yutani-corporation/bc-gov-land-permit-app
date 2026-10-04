import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabaseConnection } from '../client.js';
import { parseDatabaseConfig } from '../config.js';

const connection = createDatabaseConnection(parseDatabaseConfig());
const migrationsFolder = fileURLToPath(
  new URL('../../migrations', import.meta.url),
);

try {
  await migrate(connection.db, { migrationsFolder });
  console.log('Database migrations completed.');
} finally {
  await connection.close();
}
