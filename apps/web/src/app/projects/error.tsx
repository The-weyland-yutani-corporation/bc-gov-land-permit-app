'use client';

import { Button } from '../../components/button';

export default function ProjectsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  return (
    <main id="main-content" className="page-width">
      <header className="page-heading">
        <h1>Projects are temporarily unavailable</h1>
        <p>
          Your last confirmed changes remain saved. Retry, or return later if
          the database dependency is unavailable.
        </p>
      </header>
      <div className="notice notice--danger" role="alert">
        <strong>We could not load this project area.</strong>
      </div>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
