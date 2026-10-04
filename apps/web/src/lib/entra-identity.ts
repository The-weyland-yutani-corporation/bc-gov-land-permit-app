import 'server-only';

import type { AuthenticationConfiguration } from './auth-config';
import {
  AuthenticationFlowError,
  writeAuthenticationSession,
} from './auth-session';

export async function establishEntraSession(
  configuration: Extract<
    AuthenticationConfiguration,
    { mode: 'entra-external-id' }
  >,
  subjectId: string,
): Promise<void> {
  const {
    ExternalIdentityRepository,
    createDatabaseConnection,
    parseDatabaseConfig,
  } = await import('@permit-readiness/db');
  const connection = createDatabaseConnection(parseDatabaseConfig());
  try {
    const identity = await new ExternalIdentityRepository(
      connection.db,
    ).resolveSession({
      provider: 'entra_external_id',
      subjectId,
      organizationId: configuration.entra.organizationId,
    });
    if (!identity) {
      throw new AuthenticationFlowError(
        'This identity has no authorized application membership.',
      );
    }
    await writeAuthenticationSession(configuration, {
      ...identity,
      mode: 'entra-external-id',
    });
  } catch (error) {
    if (error instanceof AuthenticationFlowError) throw error;
    if (error instanceof Error) {
      throw new AuthenticationFlowError(
        'Application membership verification is unavailable.',
      );
    }
    throw error;
  } finally {
    await connection.close();
  }
}
