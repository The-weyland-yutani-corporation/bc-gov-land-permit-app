import { describe, expect, it } from 'vitest';
import {
  AuthenticationConfigurationError,
  readAuthenticationConfiguration,
  sealAuthenticationValue,
  unsealAuthenticationValue,
} from '../src/lib/auth';

const sessionSecret = 'test-session-secret-with-more-than-32-characters';
const env = (values: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  ...values,
});

describe('authentication configuration', () => {
  it('keeps local development convenient without a transferable default key', () => {
    const first = readAuthenticationConfiguration(env());
    const second = readAuthenticationConfiguration(env());
    expect(first.mode).toBe('local-demo');
    expect(first.appEnvironment).toBe('local');
    expect(first.sessionSecret).toBe(second.sessionSecret);
    expect(first.sessionSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('fails closed for deployed synthetic identity without explicit approval', () => {
    expect(() =>
      readAuthenticationConfiguration(
        env({
          APP_ENV: 'dev',
          AUTH_MODE: 'local-demo',
          AUTH_SESSION_SECRET: sessionSecret,
        }),
      ),
    ).toThrow(AuthenticationConfigurationError);
  });

  it('fails closed when a production server omits APP_ENV', () => {
    expect(() =>
      readAuthenticationConfiguration({
        NODE_ENV: 'production',
        AUTH_MODE: 'local-demo',
        AUTH_SESSION_SECRET: sessionSecret,
        ENABLE_SYNTHETIC_AUTH: 'true',
      }),
    ).toThrow(AuthenticationConfigurationError);
  });

  it('accepts validated Entra External ID configuration', () => {
    const configuration = readAuthenticationConfiguration(
      env({
        APP_ENV: 'prod',
        AUTH_MODE: 'entra-external-id',
        AUTH_SESSION_SECRET: sessionSecret,
        ENTRA_EXTERNAL_ID_TENANT_SUBDOMAIN: 'permit-demo',
        ENTRA_EXTERNAL_ID_CLIENT_ID: '00000000-0000-4000-8000-000000000000',
        ENTRA_EXTERNAL_ID_CLIENT_SECRET: 'confidential-client-secret',
        ENTRA_EXTERNAL_ID_AUTHORITY_HOST:
          'https://permit-demo.ciamlogin.com/tenant.onmicrosoft.com',
        ENTRA_EXTERNAL_ID_ISSUER:
          'https://permit-demo.ciamlogin.com/00000000-0000-4000-8000-000000000002/v2.0',
        ENTRA_EXTERNAL_ID_REDIRECT_URI:
          'https://permit.example/api/auth/callback/entra',
        ENTRA_EXTERNAL_ID_ORGANIZATION_ID:
          '00000000-0000-4000-8000-000000000001',
      }),
    );
    expect(configuration.mode).toBe('entra-external-id');
  });
});

describe('authentication session protection', () => {
  it('round trips authenticated encryption and rejects tampering', () => {
    const sealed = sealAuthenticationValue(
      { subject: 'example' },
      sessionSecret,
    );
    expect(unsealAuthenticationValue(sealed, sessionSecret)).toEqual({
      subject: 'example',
    });
    const tampered = sealed.split('.');
    tampered[2] = `${tampered[2]?.startsWith('A') ? 'B' : 'A'}${tampered[2]?.slice(1)}`;
    expect(() =>
      unsealAuthenticationValue(tampered.join('.'), sessionSecret),
    ).toThrow('verification failed');
  });
});
