import Link from 'next/link';
import { AuthForm } from './auth-form';

export default function LoginPage() {
  return <main className="auth-page"><Link href="/" className="brand">DripWell<span>CARE, WITH CLARITY</span></Link><section className="auth-card"><AuthForm mode="login" /></section></main>;
}
