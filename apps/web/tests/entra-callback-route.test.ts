import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completeEntraSignIn: vi.fn(),
  getEntraConfiguration: vi.fn(),
}));

vi.mock('../src/lib/entra-callback', () => ({
  completeEntraSignIn: mocks.completeEntraSignIn,
}));

vi.mock('../src/lib/entra-client', () => ({
  getEntraConfiguration: mocks.getEntraConfiguration,
}));

import { GET } from '../src/app/api/auth/callback/entra/route';

describe('Entra callback redirect origin', () => {
  it('uses the configured callback origin instead of the request host', async () => {
    mocks.getEntraConfiguration.mockReturnValue({
      entra: {
        redirectUri: 'https://permit.example/api/auth/callback/entra',
      },
    });
    mocks.completeEntraSignIn.mockResolvedValue(
      '/projects/example?tab=tasks#evidence',
    );

    const response = await GET(
      new Request(
        'https://untrusted-host.example/api/auth/callback/entra?code=code&state=state',
      ),
    );

    expect(response.headers.get('location')).toBe(
      'https://permit.example/projects/example?tab=tasks#evidence',
    );
  });
});
