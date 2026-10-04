import { describe, expect, it } from 'vitest';
import {
  LivenessResponseSchema,
  ReadinessResponseSchema,
} from '@permit-readiness/contracts';
import { GET as getLiveness } from '../src/app/api/v1/health/live/route';
import { GET as getReadiness } from '../src/app/api/v1/health/ready/route';

describe('liveness route', () => {
  it('returns the contracted response', async () => {
    const response = getLiveness();
    expect(response.status).toBe(200);
    const body = LivenessResponseSchema.parse(await response.json());
    expect(body.status).toBe('alive');
  });
});

describe('readiness route', () => {
  it('returns ready for the self-contained local mode', async () => {
    const response = await getReadiness();
    expect(response.status).toBe(200);
    const body = ReadinessResponseSchema.parse(await response.json());
    expect(body.status).toBe('ready');
  });

  it('returns 503 when deployed configuration is incomplete', async () => {
    const previous = process.env.APP_ENV;
    process.env.APP_ENV = 'prod';
    try {
      const response = await getReadiness();
      expect(response.status).toBe(503);
      const body = ReadinessResponseSchema.parse(await response.json());
      expect(body.status).toBe('not_ready');
    } finally {
      if (previous === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previous;
    }
  });
});
