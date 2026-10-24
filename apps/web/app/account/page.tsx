import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { SecuritySettings } from './security-settings';

export const metadata = { title: 'Account security', robots: { index: false, follow: false } };

export default async function AccountPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  return <main className="account-page"><nav className="public-nav"><Link href="/dashboard" className="brand">DripWell</Link><Link href={user.role === 'SYSTEM_ADMIN' ? '/platform' : '/dashboard'} className="button secondary">Back to workspace</Link></nav><header className="page-header"><span className="eyebrow">YOUR ACCOUNT</span><h1>Security, in your hands.</h1><p className="muted">{user.email}. Protect your account and manage active sessions.</p></header><SecuritySettings /></main>;
}
