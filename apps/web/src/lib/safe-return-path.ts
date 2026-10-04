export const DEFAULT_RETURN_PATH = '/projects';

const TRUSTED_RETURN_ORIGIN = 'https://permit-readiness.invalid';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/u;
const ENCODED_CONTROL_OR_BACKSLASH =
  /%(?:0[0-9a-f]|1[0-9a-f]|5c|7f|c2(?:8[0-9a-f]|9[0-9a-f]))/iu;

function isSafePathCandidate(value: string): boolean {
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    CONTROL_CHARACTERS.test(value) ||
    ENCODED_CONTROL_OR_BACKSLASH.test(value)
  ) {
    return false;
  }

  const normalized = value.normalize('NFKC');
  if (
    normalized.includes('\\') ||
    CONTROL_CHARACTERS.test(normalized) ||
    !normalized.startsWith('/') ||
    normalized.startsWith('//')
  ) {
    return false;
  }

  const resolved = new URL(value, TRUSTED_RETURN_ORIGIN);
  return (
    resolved.origin === TRUSTED_RETURN_ORIGIN &&
    !resolved.username &&
    !resolved.password &&
    resolved.pathname.startsWith('/') &&
    !resolved.pathname.startsWith('//') &&
    !resolved.pathname.includes('\\') &&
    !CONTROL_CHARACTERS.test(
      `${resolved.pathname}${resolved.search}${resolved.hash}`,
    )
  );
}

export function safeReturnPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_RETURN_PATH;

  let candidate = value;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!isSafePathCandidate(candidate)) return DEFAULT_RETURN_PATH;

    let decoded: string;
    try {
      decoded = decodeURIComponent(candidate);
    } catch {
      break;
    }
    if (decoded === candidate) break;
    if (depth === 7) return DEFAULT_RETURN_PATH;
    candidate = decoded;
  }

  const resolved = new URL(value, TRUSTED_RETURN_ORIGIN);
  const normalized = `${resolved.pathname}${resolved.search}${resolved.hash}`;
  return isSafePathCandidate(normalized) ? normalized : DEFAULT_RETURN_PATH;
}
