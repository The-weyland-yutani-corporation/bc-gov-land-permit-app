import { AuthError } from '@azure/msal-node';
import { NextResponse } from 'next/server';
import {
  AuthenticationConfigurationError,
  AuthenticationFlowError,
} from '../../../../lib/auth';
import { beginEntraSignIn } from '../../../../lib/entra-login';

export async function GET(request: Request) {
  try {
    const returnTo = new URL(request.url).searchParams.get('returnTo');
    return NextResponse.redirect(await beginEntraSignIn(returnTo ?? undefined));
  } catch (error) {
    if (
      error instanceof AuthenticationConfigurationError ||
      error instanceof AuthenticationFlowError ||
      error instanceof AuthError
    ) {
      return NextResponse.json(
        { error: 'Authentication is unavailable.' },
        { status: 503 },
      );
    }
    throw error;
  }
}
