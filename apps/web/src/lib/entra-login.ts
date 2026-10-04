import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import {
  authenticationCookieOptions,
  sealAuthenticationValue,
} from './auth-session';
import {
  createEntraClient,
  ENTRA_SCOPES,
  ENTRA_STATE_COOKIE,
  EntraStateSchema,
  getEntraConfiguration,
} from './entra-client';
import { safeReturnPath } from './safe-return-path';

const STATE_TTL_SECONDS = 60 * 10;

export async function beginEntraSignIn(returnTo?: string): Promise<string> {
  const configuration = getEntraConfiguration();
  const { ConfidentialClientApplication, CryptoProvider } = await import(
    '@azure/msal-node'
  );
  const { verifier, challenge } =
    await new CryptoProvider().generatePkceCodes();
  const state = EntraStateSchema.parse({
    state: randomBytes(32).toString('base64url'),
    nonce: randomBytes(32).toString('base64url'),
    codeVerifier: verifier,
    returnTo: safeReturnPath(returnTo),
    expiresAt: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
  });
  (await cookies()).set(
    ENTRA_STATE_COOKIE,
    sealAuthenticationValue(state, configuration.sessionSecret),
    {
      ...authenticationCookieOptions(configuration),
      maxAge: STATE_TTL_SECONDS,
    },
  );
  return createEntraClient(
    configuration,
    ConfidentialClientApplication,
  ).getAuthCodeUrl({
    scopes: ENTRA_SCOPES,
    redirectUri: configuration.entra.redirectUri,
    responseMode: 'query',
    state: state.state,
    nonce: state.nonce,
    codeChallenge: challenge,
    codeChallengeMethod: 'S256',
  });
}
