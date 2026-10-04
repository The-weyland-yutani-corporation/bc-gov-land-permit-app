import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { AuthenticationConfiguration } from './auth-config';

const SESSION_COOKIE = 'permit_readiness_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export const AuthSessionSchema = z
  .object({
    userId: z.string().uuid(),
    organizationId: z.string().uuid(),
    displayName: z.string().min(1).max(160),
    email: z.string().email().optional(),
    mode: z.enum(['local-demo', 'entra-external-id']),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export type AuthSession = z.infer<typeof AuthSessionSchema>;

export class AuthenticationFlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationFlowError';
  }
}

function key(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function sealAuthenticationValue(
  value: unknown,
  secret: string,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.');
}

export function unsealAuthenticationValue(
  value: string,
  secret: string,
): unknown {
  const [version, encodedIv, encodedCiphertext, encodedTag, extra] =
    value.split('.');
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedCiphertext ||
    !encodedTag ||
    extra
  ) {
    throw new AuthenticationFlowError('Authentication cookie is malformed.');
  }
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key(secret),
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
        decipher.final(),
      ]).toString('utf8'),
    );
  } catch {
    throw new AuthenticationFlowError(
      'Authentication cookie verification failed.',
    );
  }
}

export function authenticationCookieOptions(
  configuration: AuthenticationConfiguration,
) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: configuration.appEnvironment !== 'local',
    path: '/',
    priority: 'high' as const,
  };
}

export async function readAuthenticationSession(
  configuration: AuthenticationConfiguration,
): Promise<AuthSession | null> {
  const encoded = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!encoded) return null;
  try {
    const session = AuthSessionSchema.parse(
      unsealAuthenticationValue(encoded, configuration.sessionSecret),
    );
    return session.mode === configuration.mode &&
      session.expiresAt > Math.floor(Date.now() / 1000)
      ? session
      : null;
  } catch (error) {
    if (
      error instanceof AuthenticationFlowError ||
      error instanceof z.ZodError
    ) {
      return null;
    }
    throw error;
  }
}

export async function writeAuthenticationSession(
  configuration: AuthenticationConfiguration,
  session: Omit<AuthSession, 'expiresAt'>,
): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  (await cookies()).set(
    SESSION_COOKIE,
    sealAuthenticationValue(
      { ...session, expiresAt },
      configuration.sessionSecret,
    ),
    {
      ...authenticationCookieOptions(configuration),
      maxAge: SESSION_TTL_SECONDS,
    },
  );
}

export async function clearAuthenticationSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
