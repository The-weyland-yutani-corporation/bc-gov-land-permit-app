import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteChrome } from '../components/site-chrome';
import 'azure-maps-control/dist/atlas.min.css';
import '../styles/tokens.css';
import '../styles/site.css';

export const metadata: Metadata = {
  title: {
    default: 'Permit Readiness — Demonstration service',
    template: '%s — Permit Readiness demonstration',
  },
  description:
    'A synthetic public-sector demonstration for preparing land-project permit questions.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" data-scroll-behavior="smooth">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
