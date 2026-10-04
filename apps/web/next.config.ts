import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  output: 'standalone',
  poweredByHeader: false,
  serverExternalPackages: ['postgres'],
  transpilePackages: [
    '@permit-readiness/contracts',
    '@permit-readiness/db',
    '@permit-readiness/domain',
    '@permit-readiness/jurisdiction-config',
  ],
};

export default nextConfig;
