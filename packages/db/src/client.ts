import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { DatabaseConfig } from './config.js';
import { schema, type DatabaseSchema } from './schema.js';

export type Database = PostgresJsDatabase<DatabaseSchema>;
export type DatabaseExecutor = Pick<
  Database,
  'delete' | 'execute' | 'insert' | 'select' | 'update'
>;

export interface DatabaseConnection {
  readonly db: Database;
  readonly sql: Sql;
  close(): Promise<void>;
}

export function createDatabaseConnection(
  config: DatabaseConfig,
): DatabaseConnection {
  const sql = postgres(config.url, {
    max: config.maxConnections,
    ssl: config.ssl,
    prepare: false,
  });
  const db = drizzle(sql, { schema });

  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
