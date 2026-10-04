import Link from 'next/link';
import { Button } from '../components/button';

export default function NotFound() {
  return (
    <main id="main-content" className="page-width">
      <header className="page-heading">
        <h1>Page not found</h1>
        <p>
          The requested item is unavailable or does not belong to the active
          organization.
        </p>
      </header>
      <Button asChild>
        <Link href="/projects">Return to your projects</Link>
      </Button>
    </main>
  );
}
