import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETURN_PATH,
  safeReturnPath,
} from '../src/lib/safe-return-path';

describe('safe post-auth return paths', () => {
  it.each([
    undefined,
    null,
    '',
    'projects',
    '//evil.example',
    '/\\evil.example',
    '/\\\\evil.example',
    '/%5Cevil.example',
    '/%255Cevil.example',
    `/${encodeURIComponent(
      encodeURIComponent(encodeURIComponent(encodeURIComponent('%5Cevil'))),
    )}`,
    '/projects/%0Aevil',
    '/projects/%250devil',
    '/projects/\u0000evil',
    'https://evil.example/projects',
    'javascript:alert(1)',
    '//permit-readiness.invalid@evil.example/projects',
    '/%2F%2Fevil.example',
    '/%252F%252Fevil.example',
    '/projects/..//evil.example',
    '/projects/%2e%2e//evil.example',
  ])('fails unsafe return value %j to the default', (value) => {
    expect(safeReturnPath(value)).toBe(DEFAULT_RETURN_PATH);
  });

  it.each([
    ['/projects', '/projects'],
    ['/projects/example/intake', '/projects/example/intake'],
    [
      '/projects/example/../another/summary?tab=tasks#evidence',
      '/projects/another/summary?tab=tasks#evidence',
    ],
    [
      '/projects/example?filter=needs%20review&next=%2Fprojects%2Fnew#summary',
      '/projects/example?filter=needs%20review&next=%2Fprojects%2Fnew#summary',
    ],
  ])('normalizes and preserves safe local path %s', (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });
});
