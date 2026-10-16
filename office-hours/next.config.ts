import type { NextConfig } from 'next';
import path from 'node:path';

// Served at sevcp.sedc.gov.ng/office-hours via a rewrite from the main SEVCP site,
// so every route lives under this base path.
const nextConfig: NextConfig = {
  basePath: '/office-hours',
  serverExternalPackages: ['@electric-sql/pglite'],
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
