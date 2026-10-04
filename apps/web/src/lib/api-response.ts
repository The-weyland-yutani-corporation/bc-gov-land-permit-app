import { ApiErrorSchema } from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';

export function apiError(
  status: number,
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHENTICATED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'VALIDATION_FAILED'
    | 'DEPENDENCY_UNAVAILABLE'
    | 'INTERNAL_ERROR',
  message: string,
) {
  const body = ApiErrorSchema.parse({
    error: {
      code,
      message,
      correlationId: crypto.randomUUID(),
      retryable: status >= 500,
    },
  });
  return NextResponse.json(body, { status });
}
