import { describe, expect, it, vi } from 'vitest';
import { evaluateReadiness } from '../src/lib/readiness';

const deployedEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  APP_ENV: 'dev',
  AUTH_MODE: 'local-demo',
  ENABLE_SYNTHETIC_AUTH: 'true',
  AUTH_SESSION_SECRET: 'test-session-secret-with-more-than-32-characters',
  DATABASE_URL: 'postgresql://example.invalid/permit_readiness',
};

describe('readiness evaluation', () => {
  it('reports local in-memory dependencies ready', async () => {
    const dependencies = await evaluateReadiness({ NODE_ENV: 'test' });
    expect(dependencies.every(({ status }) => status === 'ready')).toBe(true);
  });

  it('reports deployed configuration without a database as degraded', async () => {
    const dependencies = await evaluateReadiness({
      ...deployedEnvironment,
      DATABASE_URL: undefined,
    });
    expect(
      dependencies.find(({ name }) => name === 'configuration')?.status,
    ).toBe('unavailable');
  });

  it('reports invalid database configuration as degraded', async () => {
    const dependencies = await evaluateReadiness({
      ...deployedEnvironment,
      DATABASE_URL: 'not-a-postgres-url',
    });
    expect(
      dependencies.find(({ name }) => name === 'configuration')?.status,
    ).toBe('unavailable');
  });

  it('reports database and reference failures without internal errors', async () => {
    const check = vi.fn().mockRejectedValue(new Error('sensitive connection'));
    const dependencies = await evaluateReadiness(deployedEnvironment, check);
    expect(check).toHaveBeenCalledOnce();
    expect(dependencies.find(({ name }) => name === 'database')?.detail).toBe(
      'PostgreSQL is unavailable.',
    );
    expect(JSON.stringify(dependencies)).not.toContain('sensitive connection');
  });

  it('requires identity and reference data from PostgreSQL', async () => {
    const dependencies = await evaluateReadiness(
      deployedEnvironment,
      async () => ({
        connected: true,
        referenceDataReady: false,
        identityDataReady: false,
      }),
    );
    expect(
      dependencies.filter(({ status }) => status === 'unavailable'),
    ).toHaveLength(2);
  });
});
