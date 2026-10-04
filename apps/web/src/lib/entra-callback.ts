import 'server-only';

import { cookies } from 'next/headers';
import {
  AuthenticationFlowError,
  unsealAuthenticationValue,
} from './auth-session';
import {
  createEntraClient,
  ENTRA_SCOPES,
  ENTRA_STATE_COOKIE,
  EntraClaimsSchema,
  EntraStateSchema,
  getEntraConfiguration,
} from './entra-client';
import { establishEntraSession } from './entra-identity';
import { safeReturnPath } from './safe-return-path';

export async function completeEntraSignIn(requestUrl: string): Promise<string> {
  const configuration = getEntraConfiguration();
  const url = new URL(requestUrl);
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const encodedState = (await cookies()).get(ENTRA_STATE_COOKIE)?.value;
  if (!code || !returnedState || !encodedState) {
    throw new AuthenticationFlowError(
      'The authorization response is incomplete.',
    );
  }
  const state = EntraStateSchema.parse(
    unsealAuthenticationValue(encodedState, configuration.sessionSecret),
  );
  if (
    state.expiresAt <= Math.floor(Date.now() / 1000) ||
    state.state !== returnedState
  ) {
    throw new AuthenticationFlowError(
      'The authorization response state is invalid or expired.',
    );
  }

  const { ConfidentialClientApplication } = await import('@azure/msal-node');
  const result = await createEntraClient(
    configuration,
    ConfidentialClientApplication,
  ).acquireTokenByCode({
    code,
    scopes: ENTRA_SCOPES,
    redirectUri: configuration.entra.redirectUri,
    codeVerifier: state.codeVerifier,
    nonce: state.nonce,
    state: state.state,
  });
  const claims = EntraClaimsSchema.parse(result.idTokenClaims);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    claims.iss.replace(/\/+$/, '') !== configuration.entra.issuer ||
    !audience.includes(configuration.entra.clientId) ||
    claims.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new AuthenticationFlowError(
      'The verified identity token does not match this application.',
    );
  }
  await establishEntraSession(configuration, claims.sub);
  (await cookies()).delete(ENTRA_STATE_COOKIE);
  return safeReturnPath(state.returnTo);
}
