import Link from 'next/link';

export default function HomePage() {
  return <main className="public-page">
    <nav className="public-nav"><Link href="/" className="brand">DripWell<span>CARE, WITH CLARITY</span></Link><Link href="/login" className="button secondary">Sign in</Link></nav>
    <section className="public-hero">
      <span className="eyebrow">THE CONSULTATION WORKSPACE FOR IV CLINICS</span>
      <h1>More presence.<br />A clearer plan.</h1>
      <p>Guide the conversation, review recommendations, and give every client a thoughtful takeaway. Your clinic&apos;s offerings. Your team&apos;s judgment.</p>
      <div className="actions"><Link href="/register" className="button primary">Start your 14-day trial</Link><Link href="/login" className="button secondary">Open your workspace</Link></div>
      <p className="muted small">Includes 10 initial consultations. No automatic paid enrollment.</p>
    </section>
    <section className="public-features">
      <article><span className="step-number">01</span><h2>Set your standard</h2><p>Organize your catalog, official prices, questions, and clinic protocols in one owner-approved configuration.</p></article>
      <article><span className="step-number">02</span><h2>Stay in the conversation</h2><p>Record with consent, see the questions that matter, and review every recommendation before sharing.</p></article>
      <article><span className="step-number">03</span><h2>Follow through</h2><p>Track actual care and client decisions, produce a polished takeaway, and learn from your team&apos;s adjustments.</p></article>
    </section>
    <footer className="public-footer">DripWell <span>Guided documentation. Provider-approved care.</span></footer>
  </main>;
}
