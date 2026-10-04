import 'server-only';

import type { ReadinessResponse } from '@permit-readiness/contracts';
import { z } from 'zod';
import {
  AuthenticationConfigurationError,
  readAuthenticationConfiguration,
} from './auth-config';
import { demoProjectTypes, getDemoQuestionSet } from './demo-config';
import {
  checkPostgresReadiness,
  type DatabaseReadiness,
} from './readiness-database';

type Dependency = ReadinessResponse['dependencies'][number];
type DatabaseCheck = (
  environment: NodeJS.ProcessEnv,
  organizationId: string,
  provider: 'local_demo' | 'entra_external_id',
  timeoutMs: number,
) => Promise<DatabaseReadiness>;

function result(
  name: Dependency['name'],
  ready: boolean,
  detail: string,
): Dependency {
  return { name, status: ready ? 'ready' : 'unavailable', detail };
}

function localReferenceDataReady(): boolean {
  return (
    demoProjectTypes.length > 0 &&
    demoProjectTypes.every(
      (type) => getDemoQuestionSet(type.id).questions.length > 0,
    )
  );
}

export async function evaluateReadiness(
  environment: NodeJS.ProcessEnv = process.env,
  databaseCheck: DatabaseCheck = checkPostgresReadiness,
): Promise<ReadinessResponse['dependencies']> {
  const runtime = z
    .object({
      APP_ENV: z.enum(['local', 'dev', 'prod']).optional(),
      NODE_ENV: z.string().optional(),
      DATABASE_URL: z.string().optional(),
      READINESS_TIMEOUT_MS: z.coerce
        .number()
        .int()
        .min(250)
        .max(5000)
        .default(2000),
    })
    .passthrough()
    .safeParse(environment);
  if (!runtime.success) {
    return [
      result('configuration', false, 'Runtime configuration is invalid.'),
      result('authentication', false, 'Authentication is not configured.'),
      result('database', false, 'Repository mode is not configured.'),
      result('reference_data', false, 'Reference data was not checked.'),
    ];
  }

  const deployed =
    runtime.data.APP_ENV !== undefined
      ? runtime.data.APP_ENV !== 'local'
      : runtime.data.NODE_ENV === 'production';
  const hasDatabase = Boolean(runtime.data.DATABASE_URL);
  let repositoryConfigured = hasDatabase || !deployed;
  if (hasDatabase) {
    try {
      const { parseDatabaseConfig } = await import('@permit-readiness/db');
      parseDatabaseConfig(environment);
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      repositoryConfigured = false;
    }
  }
  const dependencies = [
    result(
      'configuration',
      repositoryConfigured,
      repositoryConfigured
        ? 'Runtime configuration is valid.'
        : 'Repository configuration is invalid.',
    ),
  ];
  let auth: ReturnType<typeof readAuthenticationConfiguration> | null = null;
  try {
    auth = readAuthenticationConfiguration(environment);
  } catch (error) {
    if (!(error instanceof AuthenticationConfigurationError)) throw error;
  }
  dependencies.push(
    result(
      'authentication',
      Boolean(auth),
      auth
        ? 'Authentication configuration is valid.'
        : 'Authentication configuration is invalid.',
    ),
  );

  if (!hasDatabase) {
    const referenceReady = !deployed && localReferenceDataReady();
    dependencies.push(
      result(
        'database',
        !deployed,
        !deployed
          ? 'Local in-memory repository is active.'
          : 'PostgreSQL is unavailable.',
      ),
      result(
        'reference_data',
        referenceReady,
        referenceReady
          ? 'Bundled reference data is loaded.'
          : 'Required reference data is unavailable.',
      ),
    );
    return dependencies;
  }
  if (!repositoryConfigured) {
    dependencies.push(
      result('database', false, 'Database check was not attempted.'),
      result('reference_data', false, 'Reference data was not checked.'),
    );
    return dependencies;
  }
  if (!auth) {
    dependencies.push(
      result('database', false, 'Database check was not attempted.'),
      result('reference_data', false, 'Reference data was not checked.'),
    );
    return dependencies;
  }

  return checkConfiguredDatabase(
    dependencies,
    environment,
    auth.mode === 'entra-external-id'
      ? auth.entra.organizationId
      : '22222222-2222-4222-8222-222222222222',
    auth.mode === 'entra-external-id' ? 'entra_external_id' : 'local_demo',
    runtime.data.READINESS_TIMEOUT_MS,
    databaseCheck,
  );
}

async function checkConfiguredDatabase(
  dependencies: Dependency[],
  environment: NodeJS.ProcessEnv,
  organizationId: string,
  provider: 'local_demo' | 'entra_external_id',
  timeoutMs: number,
  databaseCheck: DatabaseCheck,
): Promise<Dependency[]> {
  try {
    const check = await databaseCheck(
      environment,
      organizationId,
      provider,
      timeoutMs,
    );
    dependencies[1] = result(
      'authentication',
      check.identityDataReady,
      check.identityDataReady
        ? 'Application identity mapping is available.'
        : 'Required application identity data is missing.',
    );
    dependencies.push(
      result(
        'database',
        check.connected,
        check.connected
          ? 'PostgreSQL connection succeeded.'
          : 'PostgreSQL is unavailable.',
      ),
      result(
        'reference_data',
        check.referenceDataReady,
        check.referenceDataReady
          ? 'Required reference data is loaded.'
          : 'Required reference data is missing.',
      ),
    );
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    dependencies.push(
      result('database', false, 'PostgreSQL is unavailable.'),
      result('reference_data', false, 'Reference data was not checked.'),
    );
  }
  return dependencies;
}
