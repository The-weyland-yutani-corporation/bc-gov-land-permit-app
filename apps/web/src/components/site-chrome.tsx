import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOutAction } from '../app/actions';
import { getOptionalSession } from '../lib/auth';

export async function SiteChrome({ children }: { children: ReactNode }) {
  const session = await getOptionalSession();

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="demo-banner" role="status">
        Demonstration — not an official government service
      </div>
      <header className="masthead">
        <div className="page-width masthead__row">
          <Link href="/" aria-label="Permit Readiness home">
            <span
              className="brand-placeholder"
              data-brand-placeholder
              role="img"
              aria-label="Approved Government of British Columbia mark required"
            >
              <strong>BC Mark</strong>
              approved asset required
            </span>
          </Link>
          <div className="service-title">Permit Readiness</div>
          <nav className="masthead__actions" aria-label="Utility navigation">
            <Link href="/#about">About this demo</Link>
            {session ? (
              <form action={signOutAction}>
                <button className="text-link" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <Link href="/sign-in">Sign in</Link>
            )}
          </nav>
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Mobile utility navigation">
              <Link href="/#about">About this demo</Link>
              <Link href={session ? '/projects' : '/sign-in'}>
                {session ? 'My projects' : 'Sign in'}
              </Link>
            </nav>
          </details>
        </div>
        <div className="gold-rule" />
      </header>
      {session ? (
        <nav className="app-nav" aria-label="Primary navigation">
          <ul className="page-width">
            <li>
              <Link href="/projects">Projects</Link>
            </li>
            <li>
              <Link href="/projects">Readiness reports</Link>
            </li>
            <li>
              <Link href="/help">Help</Link>
            </li>
          </ul>
        </nav>
      ) : null}
      {children}
      <footer className="site-footer">
        <div className="site-footer__rule" />
        <div className="page-width site-footer__content">
          <div>
            <p>
              <strong>Permit Readiness demonstration</strong>
            </p>
            <p className="site-footer__note">
              Unofficial, non-binding, and based on synthetic content.
            </p>
          </div>
          <nav aria-label="Footer navigation">
            <ul>
              <li>
                <Link href="/#about">About</Link>
              </li>
              <li>
                <Link href="/help">Privacy and accessibility</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="page-width copyright">
          © 2026 Permit Readiness reference project
        </div>
      </footer>
    </>
  );
}
