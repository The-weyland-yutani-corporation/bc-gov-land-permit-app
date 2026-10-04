import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  AuthenticationConfigurationError,
  readAuthenticationConfiguration,
  type EntraExternalIdConfiguration,
} from './auth-config';
import {
  clearAuthenticationSession,
  readAuthenticationSession,
  writeAuthenticationSession,
  type AuthSession,
} from './auth-session';
import { ENTRA_STATE_COOKIE } from './entra-client';
import { safeReturnPath } from './safe-return-path';

export type { AuthSession } from './auth-session';
export {
  AuthenticationConfigurationError,
  readAuthenticationConfiguration,
} from './auth-config';
export {
  AuthenticationFlowError,
  sealAuthenticationValue,
  unsealAuthenticationValue,
} from './auth-session';

export interface AuthenticationAdapter {
  readonly mode: AuthSession['mode'];
  getSession(): Promise<AuthSession | null>;
  getSignInUrl(returnTo?: string): Promise<string>;
  signOut(): Promise<void>;
}

export const LOCAL_DEMO_SESSION = {
  userId: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  displayName: 'Demo applicant',
  email: 'applicant@example.invalid',
  mode: 'local-demo',
} as const;

class ConfiguredAuthenticationAdapter implements AuthenticationAdapter {
  readonly mode: AuthSession['mode'];

  constructor(
    private readonly configuration: ReturnType<
      typeof readAuthenticationConfiguration
    >,
  ) {
    this.mode = configuration.mode;
  }

  getSession(): Promise<AuthSession | null> {
    return readAuthenticationSession(this.configuration);
  }

  async getSignInUrl(returnTo = '/projects'): Promise<string> {
    const target = safeReturnPath(returnTo);
    return this.mode === 'entra-external-id'
      ? `/api/auth/sign-in?returnTo=${encodeURIComponent(target)}`
      : `/sign-in?returnTo=${encodeURIComponent(target)}`;
  }

  async signOut(): Promise<void> {
    await clearAuthenticationSession();
    if (this.mode === 'entra-external-id') {
      (await cookies()).delete(ENTRA_STATE_COOKIE);
    }
  }
}

export function getAuthenticationAdapter(): AuthenticationAdapter {
  return new ConfiguredAuthenticationAdapter(readAuthenticationConfiguration());
}

export function readEntraExternalIdConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): EntraExternalIdConfiguration | null {
  try {
    const configuration = readAuthenticationConfiguration(environment);
    return configuration.mode === 'entra-external-id'
      ? configuration.entra
      : null;
  } catch (error) {
    if (error instanceof AuthenticationConfigurationError) return null;
    throw error;
  }
}

export async function getOptionalSession(): Promise<AuthSession | null> {
  return getAuthenticationAdapter().getSession();
}

export async function requireSession(
  returnTo = '/projects',
): Promise<AuthSession> {
  const session = await getOptionalSession();
  if (!session) {
    redirect(
      `/sign-in?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`,
    );
  }
  return session;
}

export async function enableLocalDemoSession(): Promise<void> {
  const configuration = readAuthenticationConfiguration();
  if (configuration.mode !== 'local-demo') {
    throw new Error('Synthetic identity is disabled.');
  }
  await writeAuthenticationSession(configuration, LOCAL_DEMO_SESSION);
}

export async function clearSession(): Promise<void> {
  await getAuthenticationAdapter().signOut();
}

export function getAuthenticationStatus() {
  try {
    const configuration = readAuthenticationConfiguration();
    return {
      mode: configuration.mode,
      available: true,
      configured: true,
      deployedSyntheticIdentity:
        configuration.mode === 'local-demo' &&
        configuration.deployedSyntheticIdentity,
    };
  } catch (error) {
    if (!(error instanceof AuthenticationConfigurationError)) throw error;
    return {
      mode:
        process.env.AUTH_MODE === 'entra-external-id'
          ? ('entra-external-id' as const)
          : ('local-demo' as const),
      available: false,
      configured: false,
      deployedSyntheticIdentity: false,
    };
  }
}
