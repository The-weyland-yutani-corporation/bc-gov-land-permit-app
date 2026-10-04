import { AuthError } from '@azure/msal-node';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AuthenticationConfigurationError,
  AuthenticationFlowError,
} from '../../../../../lib/auth';
import { completeEntraSignIn } from '../../../../../lib/entra-callback';
import { getEntraConfiguration } from '../../../../../lib/entra-client';

export async function GET(request: Request) {
  let applicationOrigin: string | undefined;
  try {
    applicationOrigin = new URL(getEntraConfiguration().entra.redirectUri)
      .origin;
    const returnTo = await completeEntraSignIn(request.url);
    return NextResponse.redirect(new URL(returnTo, applicationOrigin));
  } catch (error) {
    if (
      error instanceof AuthenticationFlowError ||
      error instanceof AuthenticationConfigurationError ||
      error instanceof AuthError ||
      error instanceof z.ZodError
    ) {
      if (!applicationOrigin) {
        return NextResponse.json(
          { error: 'Authentication is unavailable.' },
          { status: 503 },
        );
      }
      return NextResponse.redirect(
        new URL('/sign-in?error=authentication_failed', applicationOrigin),
      );
    }
    throw error;
  }
}
