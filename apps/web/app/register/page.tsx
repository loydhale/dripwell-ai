import Link from 'next/link';
import { AuthForm } from '../login/auth-form';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  return <main className="auth-page"><Link href="/" className="brand">DripWell<span>CARE, WITH CLARITY</span></Link><section className="auth-card"><AuthForm mode="register" referralCode={typeof ref === 'string' ? ref : ''} /></section></main>;
}
