import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthenticationFlowError,
  sealAuthenticationValue,
} from '../src/lib/auth';
import { ENTRA_STATE_COOKIE } from '../src/lib/entra-client';

const mocks = vi.hoisted(() => ({
  acquireTokenByCode: vi.fn(),
  cookieDelete: vi.fn(),
  cookieGet: vi.fn(),
  establishEntraSession: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    delete: mocks.cookieDelete,
    get: mocks.cookieGet,
  })),
}));

vi.mock('@azure/msal-node', () => ({
  ConfidentialClientApplication: class {
    acquireTokenByCode = mocks.acquireTokenByCode;
  },
}));

vi.mock('../src/lib/entra-identity', () => ({
  establishEntraSession: mocks.establishEntraSession,
}));

import { completeEntraSignIn } from '../src/lib/entra-callback';

const sessionSecret = 'test-session-secret-with-more-than-32-characters';
const clientId = '00000000-0000-4000-8000-000000000000';
const issuer =
  'https://permit-demo.ciamlogin.com/00000000-0000-4000-8000-000000000002/v2.0';
const state = {
  state: 'state-value-with-enough-entropy',
  nonce: 'nonce-value-with-enough-entropy',
  codeVerifier: 'code-verifier-with-at-least-thirty-two-characters',
  returnTo: '/projects/example',
  expiresAt: Math.floor(Date.now() / 1000) + 600,
};

function configureEntra() {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ENV', 'prod');
  vi.stubEnv('AUTH_MODE', 'entra-external-id');
  vi.stubEnv('AUTH_SESSION_SECRET', sessionSecret);
  vi.stubEnv('ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN', 'permit-demo');
  vi.stubEnv('ENTRA_EXTERNAL_ID_CLIENT_ID', clientId);
  vi.stubEnv('ENTRA_EXTERNAL_ID_CLIENT_SECRET', 'confidential-client-secret');
  vi.stubEnv(
    'ENTRA_EXTERNAL_ID_AUTHORITY_HOST',
    'https://permit-demo.ciamlogin.com/tenant.onmicrosoft.com',
  );
  vi.stubEnv('ENTRA_EXTERNAL_ID_ISSUER', issuer);
  vi.stubEnv(
    'ENTRA_EXTERNAL_ID_REDIRECT_URI',
    'https://permit.example/api/auth/callback/entra',
  );
  vi.stubEnv(
    'ENTRA_EXTERNAL_ID_ORGANIZATION_ID',
    '00000000-0000-4000-8000-000000000001',
  );
}

describe('Entra External ID callback', () => {
  beforeEach(() => {
    configureEntra();
    mocks.cookieGet.mockImplementation((name: string) =>
      name === ENTRA_STATE_COOKIE
        ? { value: sealAuthenticationValue(state, sessionSecret) }
        : undefined,
    );
    mocks.acquireTokenByCode.mockResolvedValue({
      idTokenClaims: {
        sub: 'external-subject',
        iss: issuer,
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 600,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('validates state and claims before establishing a session', async () => {
    await expect(
      completeEntraSignIn(
        `https://permit.example/api/auth/callback/entra?code=authorization-code&state=${state.state}`,
      ),
    ).resolves.toBe('/projects/example');

    expect(mocks.acquireTokenByCode).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'authorization-code',
        codeVerifier: state.codeVerifier,
        nonce: state.nonce,
        redirectUri: 'https://permit.example/api/auth/callback/entra',
        state: state.state,
      }),
    );
    expect(mocks.establishEntraSession).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'entra-external-id' }),
      'external-subject',
    );
    expect(mocks.cookieDelete).toHaveBeenCalledWith(ENTRA_STATE_COOKIE);
  });

  it('rejects incomplete or mismatched authorization responses', async () => {
    await expect(
      completeEntraSignIn(
        'https://permit.example/api/auth/callback/entra?state=missing-code',
      ),
    ).rejects.toThrow(AuthenticationFlowError);
    await expect(
      completeEntraSignIn(
        'https://permit.example/api/auth/callback/entra?code=authorization-code&state=wrong-state',
      ),
    ).rejects.toThrow('state is invalid or expired');

    expect(mocks.acquireTokenByCode).not.toHaveBeenCalled();
    expect(mocks.establishEntraSession).not.toHaveBeenCalled();
  });

  it('rejects token claims that do not match the configured application', async () => {
    mocks.acquireTokenByCode.mockResolvedValue({
      idTokenClaims: {
        sub: 'external-subject',
        iss: 'https://other.ciamlogin.com/tenant/v2.0',
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 600,
      },
    });

    await expect(
      completeEntraSignIn(
        `https://permit.example/api/auth/callback/entra?code=authorization-code&state=${state.state}`,
      ),
    ).rejects.toThrow('does not match this application');
    expect(mocks.establishEntraSession).not.toHaveBeenCalled();
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });

  it('fails an unsafe sealed return path to the local default', async () => {
    mocks.cookieGet.mockImplementation((name: string) =>
      name === ENTRA_STATE_COOKIE
        ? {
            value: sealAuthenticationValue(
              { ...state, returnTo: '/%5Cevil.example' },
              sessionSecret,
            ),
          }
        : undefined,
    );

    await expect(
      completeEntraSignIn(
        `https://permit.example/api/auth/callback/entra?code=authorization-code&state=${state.state}`,
      ),
    ).resolves.toBe('/projects');
  });
});
