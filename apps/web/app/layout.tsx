import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'DripWell | Thoughtful care, clearly documented', template: '%s | DripWell' },
  description: 'A guided consultation workspace for IV wellness clinics.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.svg', apple: '/icon-192.svg' },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'DripWell' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#174e47' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className={GeistSans.className}>{children}</body></html>;
}
