import 'server-only';

import { DEMO_RELEASE } from './demo-config';

export interface DatabaseReadiness {
  readonly connected: boolean;
  readonly referenceDataReady: boolean;
  readonly identityDataReady: boolean;
}

async function bounded<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function checkPostgresReadiness(
  environment: NodeJS.ProcessEnv,
  organizationId: string,
  provider: 'local_demo' | 'entra_external_id',
  timeoutMs: number,
): Promise<DatabaseReadiness> {
  const { createDatabaseConnection, parseDatabaseConfig } = await import(
    '@permit-readiness/db'
  );
  const connection = createDatabaseConnection(parseDatabaseConfig(environment));
  try {
    const rows = await bounded(
      connection.sql<DatabaseReadiness[]>`
        select true as "connected",
          (
            exists (select 1 from intake_question_sets
              where jurisdiction_id = ${DEMO_RELEASE.jurisdictionId}
                and release_version = ${DEMO_RELEASE.releaseVersion})
            and exists (select 1 from permit_types
              where jurisdiction_id = ${DEMO_RELEASE.jurisdictionId}
                and release_version = ${DEMO_RELEASE.releaseVersion})
            and exists (select 1 from permit_rules
              where jurisdiction_id = ${DEMO_RELEASE.jurisdictionId}
                and release_version = ${DEMO_RELEASE.releaseVersion})
          ) as "referenceDataReady",
          (
            exists (select 1 from organizations where id = ${organizationId})
            and exists (
              select 1 from memberships
              inner join users on users.id = memberships.user_id
              where memberships.organization_id = ${organizationId}
                and users.provider = ${provider}
            )
          )
            as "identityDataReady"
      `,
      timeoutMs,
    );
    return (
      rows[0] ?? {
        connected: false,
        referenceDataReady: false,
        identityDataReady: false,
      }
    );
  } finally {
    await bounded(connection.close(), Math.min(timeoutMs, 1000));
  }
}
