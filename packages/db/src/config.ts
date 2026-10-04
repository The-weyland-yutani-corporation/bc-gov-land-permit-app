import { z } from 'zod';

const DatabaseEnvironmentSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .url()
      .refine(
        (value) =>
          value.startsWith('postgres://') || value.startsWith('postgresql://'),
        'DATABASE_URL must use the postgres or postgresql scheme.',
      ),
    DATABASE_SSL_MODE: z
      .enum(['disable', 'prefer', 'require', 'verify-full'])
      .default('prefer'),
    DATABASE_MAX_CONNECTIONS: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(10),
  })
  .passthrough();

export interface DatabaseConfig {
  readonly url: string;
  readonly ssl:
    | false
    | 'prefer'
    | 'require'
    | {
        readonly rejectUnauthorized: true;
      };
  readonly maxConnections: number;
}

export function parseDatabaseConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const parsed = DatabaseEnvironmentSchema.parse(environment);
  const ssl = (() => {
    switch (parsed.DATABASE_SSL_MODE) {
      case 'disable':
        return false as const;
      case 'verify-full':
        return { rejectUnauthorized: true } as const;
      case 'require':
        return 'require' as const;
      case 'prefer':
        return 'prefer' as const;
    }
  })();

  return {
    url: parsed.DATABASE_URL,
    ssl,
    maxConnections: parsed.DATABASE_MAX_CONNECTIONS,
  };
}
