import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enableLocalDemoSession: vi.fn(),
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('../src/lib/auth', () => ({
  clearSession: vi.fn(),
  enableLocalDemoSession: mocks.enableLocalDemoSession,
  requireSession: vi.fn(),
}));

import { signInLocalDemoAction } from '../src/app/actions';

describe('local demo sign-in redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    '/%5Cevil.example',
    '/\\\\evil.example',
    '//evil.example',
    '/projects/%0Aevil',
    'https://permit-readiness.invalid@evil.example/projects',
  ])('fails unsafe return value %s to the project list', async (returnTo) => {
    const formData = new FormData();
    formData.set('returnTo', returnTo);

    await expect(signInLocalDemoAction(formData)).rejects.toThrow(
      'redirect:/projects',
    );
    expect(mocks.enableLocalDemoSession).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith('/projects');
  });

  it('preserves a normalized local project path, query, and fragment', async () => {
    const formData = new FormData();
    formData.set(
      'returnTo',
      '/projects/example/../another/summary?tab=tasks#evidence',
    );

    await expect(signInLocalDemoAction(formData)).rejects.toThrow(
      'redirect:/projects/another/summary?tab=tasks#evidence',
    );
  });
});
