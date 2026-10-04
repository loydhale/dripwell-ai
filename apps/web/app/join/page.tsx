import Link from 'next/link';
import { AuthForm } from '../login/auth-form';

export const metadata = { robots: { index: false, follow: false } };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <main className="auth-page"><Link href="/" className="brand">DripWell<span>CARE, WITH CLARITY</span></Link><section className="auth-card">{typeof token === 'string' && token.length >= 32 ? <AuthForm mode="join" invitationToken={token} /> : <><h1>Invitation link needed</h1><p>Open the invitation provided by your clinic owner.</p><Link href="/login">Return to sign in</Link></>}</section></main>;
}
