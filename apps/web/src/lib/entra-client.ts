import 'server-only';

import { z } from 'zod';
import {
  readAuthenticationConfiguration,
  type AuthenticationConfiguration,
} from './auth-config';
import { AuthenticationFlowError } from './auth-session';

export const ENTRA_STATE_COOKIE = 'permit_readiness_entra_state';
export const ENTRA_SCOPES = ['openid', 'profile', 'email'];

export const EntraStateSchema = z
  .object({
    state: z.string().min(16),
    nonce: z.string().min(16),
    codeVerifier: z.string().min(32),
    returnTo: z.string().startsWith('/'),
    expiresAt: z.number().int().positive(),
  })
  .strict();

export const EntraClaimsSchema = z
  .object({
    sub: z.string().min(3).max(255),
    iss: z.string().url(),
    aud: z.union([z.string(), z.array(z.string())]),
    exp: z.number().int().positive(),
  })
  .passthrough();

export function getEntraConfiguration() {
  const configuration = readAuthenticationConfiguration();
  if (configuration.mode !== 'entra-external-id') {
    throw new AuthenticationFlowError('Entra External ID is not active.');
  }
  return configuration;
}

export function createEntraClient(
  configuration: Extract<
    AuthenticationConfiguration,
    { mode: 'entra-external-id' }
  >,
  Client: (typeof import('@azure/msal-node'))['ConfidentialClientApplication'],
) {
  return new Client({
    auth: {
      clientId: configuration.entra.clientId,
      clientSecret: configuration.entra.clientSecret,
      authority: configuration.entra.authority,
      knownAuthorities: [new URL(configuration.entra.authority).hostname],
    },
  });
}
