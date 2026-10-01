import type { NextConfig } from 'next';
import { resolve } from 'node:path';
import { withEve } from 'eve/next';
import { withWorkflow } from 'workflow/next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  transpilePackages: ['@dripwell/shared'],
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'otplib'],
  outputFileTracingIncludes: {
    '/api/takeaway/*': ['./node_modules/geist/dist/fonts/geist-sans/*.ttf'],
    '/api/share/**': ['./node_modules/geist/dist/fonts/geist-sans/*.ttf'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
        { key: 'Permissions-Policy', value: 'microphone=(self), camera=(self), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
      ] },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }] },
      { source: '/share/:path*', headers: [{ key: 'Cache-Control', value: 'private, no-store, max-age=0' }, { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};

export default withEve(withWorkflow(nextConfig), { eveBuildCommand: 'pnpm build:eve' });
