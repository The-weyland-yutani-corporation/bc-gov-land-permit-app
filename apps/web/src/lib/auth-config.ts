import 'server-only';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';

declare global {
  var permitReadinessLocalSessionSecret: string | undefined;
}

export interface EntraExternalIdConfiguration {
  readonly tenantSubdomain: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly authority: string;
  readonly issuer: string;
  readonly redirectUri: string;
  readonly organizationId: string;
}

export type AuthenticationConfiguration =
  | {
      readonly appEnvironment: 'local' | 'dev' | 'prod';
      readonly mode: 'local-demo';
      readonly sessionSecret: string;
      readonly deployedSyntheticIdentity: boolean;
    }
  | {
      readonly appEnvironment: 'local' | 'dev' | 'prod';
      readonly mode: 'entra-external-id';
      readonly sessionSecret: string;
      readonly entra: EntraExternalIdConfiguration;
    };

export class AuthenticationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationConfigurationError';
  }
}

function normalizeUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function sessionSecret(
  environment: NodeJS.ProcessEnv,
  appEnvironment: 'local' | 'dev' | 'prod',
): string {
  const configured = environment.AUTH_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (appEnvironment !== 'local') {
    throw new AuthenticationConfigurationError(
      'AUTH_SESSION_SECRET must contain at least 32 characters.',
    );
  }
  globalThis.permitReadinessLocalSessionSecret ??=
    randomBytes(48).toString('base64url');
  return globalThis.permitReadinessLocalSessionSecret;
}

export function readAuthenticationConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): AuthenticationConfiguration {
  const productionBuild =
    environment.NEXT_PHASE === 'phase-production-build' ||
    environment.npm_lifecycle_event === 'build';
  const selectedEnvironment =
    environment.APP_ENV ??
    (environment.NODE_ENV !== 'production' || productionBuild
      ? 'local'
      : undefined);
  const appEnvironmentResult = z
    .enum(['local', 'dev', 'prod'])
    .safeParse(selectedEnvironment);
  const modeResult = environment.AUTH_MODE
    ? z
        .enum(['local-demo', 'entra-external-id'])
        .safeParse(environment.AUTH_MODE)
    : null;
  if (!appEnvironmentResult.success || (modeResult && !modeResult.success)) {
    throw new AuthenticationConfigurationError(
      'Authentication environment selection is invalid.',
    );
  }
  const appEnvironment = appEnvironmentResult.data;
  const mode = modeResult
    ? modeResult.data
    : appEnvironment === 'local'
      ? 'local-demo'
      : undefined;
  if (!mode) {
    throw new AuthenticationConfigurationError(
      'AUTH_MODE must be explicitly configured for deployed environments.',
    );
  }
  const secret = sessionSecret(environment, appEnvironment);
  if (mode === 'local-demo') {
    const deployedSyntheticIdentity = appEnvironment !== 'local';
    if (
      deployedSyntheticIdentity &&
      environment.ENABLE_SYNTHETIC_AUTH !== 'true'
    ) {
      throw new AuthenticationConfigurationError(
        'Deployed synthetic identity requires ENABLE_SYNTHETIC_AUTH=true.',
      );
    }
    return {
      appEnvironment,
      mode,
      sessionSecret: secret,
      deployedSyntheticIdentity,
    };
  }

  const parsed = z
    .object({
      ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN: z
        .string()
        .regex(/^[a-z0-9-]{2,63}$/i),
      ENTRA_EXTERNAL_ID_CLIENT_ID: z.string().uuid(),
      ENTRA_EXTERNAL_ID_CLIENT_SECRET: z.string().min(16),
      ENTRA_EXTERNAL_ID_AUTHORITY_HOST: z.string().url(),
      ENTRA_EXTERNAL_ID_ISSUER: z.string().url(),
      ENTRA_EXTERNAL_ID_REDIRECT_URI: z.string().url(),
      ENTRA_EXTERNAL_ID_ORGANIZATION_ID: z.string().uuid(),
    })
    .safeParse(environment);
  if (!parsed.success) {
    throw new AuthenticationConfigurationError(
      'Entra External ID configuration is incomplete or invalid.',
    );
  }
  const authority = new URL(parsed.data.ENTRA_EXTERNAL_ID_AUTHORITY_HOST);
  const issuer = new URL(parsed.data.ENTRA_EXTERNAL_ID_ISSUER);
  const expectedHost = `${parsed.data.ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN}.ciamlogin.com`;
  if (
    authority.protocol !== 'https:' ||
    issuer.protocol !== 'https:' ||
    authority.hostname !== expectedHost ||
    issuer.hostname !== expectedHost
  ) {
    throw new AuthenticationConfigurationError(
      'Entra authority and issuer must use the configured ciamlogin.com tenant.',
    );
  }
  if (
    appEnvironment !== 'local' &&
    new URL(parsed.data.ENTRA_EXTERNAL_ID_REDIRECT_URI).protocol !== 'https:'
  ) {
    throw new AuthenticationConfigurationError(
      'Deployed Entra redirect URIs must use HTTPS.',
    );
  }
  return {
    appEnvironment,
    mode,
    sessionSecret: secret,
    entra: {
      tenantSubdomain: parsed.data.ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN,
      clientId: parsed.data.ENTRA_EXTERNAL_ID_CLIENT_ID,
      clientSecret: parsed.data.ENTRA_EXTERNAL_ID_CLIENT_SECRET,
      authority: normalizeUrl(parsed.data.ENTRA_EXTERNAL_ID_AUTHORITY_HOST),
      issuer: normalizeUrl(parsed.data.ENTRA_EXTERNAL_ID_ISSUER),
      redirectUri: parsed.data.ENTRA_EXTERNAL_ID_REDIRECT_URI,
      organizationId: parsed.data.ENTRA_EXTERNAL_ID_ORGANIZATION_ID,
    },
  };
}
