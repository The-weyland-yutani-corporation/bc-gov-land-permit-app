import { redirect } from 'next/navigation';
import Link from 'next/link';
import { signInLocalDemoAction } from '../actions';
import { Breadcrumb } from '../../components/breadcrumb';
import { Button } from '../../components/button';
import {
  getAuthenticationAdapter,
  getAuthenticationStatus,
  getOptionalSession,
} from '../../lib/auth';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; error?: string }>;
}) {
  if (await getOptionalSession()) redirect('/projects');
  const { returnTo = '/projects', error } = await searchParams;
  const status = getAuthenticationStatus();
  const signInUrl = status.available
    ? await getAuthenticationAdapter().getSignInUrl(returnTo)
    : null;

  return (
    <>
      <Breadcrumb
        items={[{ label: 'Home', href: '/' }, { label: 'Sign in' }]}
      />
      <main id="main-content" className="page-width">
        <header className="page-heading">
          <p className="eyebrow">
            {status.mode === 'local-demo'
              ? 'Synthetic identity'
              : 'Microsoft Entra External ID'}
          </p>
          <h1>Sign in to the demonstration</h1>
          <p>
            Authentication establishes your server-verified identity and
            organization context. It never replaces server-side ownership
            checks.
          </p>
        </header>
        {error ? (
          <div className="notice notice--danger" role="alert">
            <strong>Sign-in was not completed.</strong> Try again or contact the
            demonstration operator if the problem continues.
          </div>
        ) : null}
        {status.available && status.mode === 'local-demo' ? (
          <section className="content-block" aria-labelledby="local-demo">
            <h2 id="local-demo">Use local demo identity</h2>
            <div className="notice notice--danger" role="note">
              <strong>Use synthetic information only.</strong> The demo session
              is an explicit synthetic identity for one demonstration
              organization. It is not a production identity.
            </div>
            <form action={signInLocalDemoAction}>
              <input type="hidden" name="returnTo" value={returnTo} />
              <Button type="submit">Continue as demo applicant</Button>
            </form>
          </section>
        ) : status.available && signInUrl ? (
          <section className="content-block" aria-labelledby="entra-sign-in">
            <h2 id="entra-sign-in">Sign in with your account</h2>
            <p>
              Continue to the configured Entra External ID tenant. Access is
              granted only when the verified subject has an application
              membership.
            </p>
            <Button asChild>
              <Link href={signInUrl}>Continue to sign in</Link>
            </Button>
          </section>
        ) : (
          <div className="notice notice--danger" role="alert">
            <strong>Sign-in is unavailable.</strong> Authentication
            configuration is missing or invalid. No substitute identity has been
            enabled.
          </div>
        )}
      </main>
    </>
  );
}
