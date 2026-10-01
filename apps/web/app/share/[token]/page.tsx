import type { Metadata } from 'next';
import { ApiError } from '@/lib/errors';
import { priceLabel, sharedDocument, validShare, type TakeawayDocument } from '@/lib/sharing';
import { VerificationForm } from './verification-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your private wellness visit | DripWell',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

function VisitDocument({ document, token }: { document: TakeawayDocument; token: string }) {
  const accent = document.clinic.brandColor;
  return (
    <article
      style={{
        maxWidth: 800,
        margin: '40px auto',
        background: '#fff',
        borderRadius: 24,
        padding: 'clamp(24px, 6vw, 56px)',
        boxShadow: '0 12px 48px #163c3510',
        borderTop: `8px solid ${accent}`,
      }}
    >
      <header style={{ paddingBottom: 28, borderBottom: '1px solid #e1ebe7' }}>
        <p style={{ color: accent, letterSpacing: '.12em', fontWeight: 700, fontSize: 13 }}>
          {document.clinic.name}
        </p>
        <h1 style={{ fontSize: 'clamp(28px, 6vw, 40px)', margin: '12px 0' }}>
          Your wellness visit
        </h1>
        <p style={{ color: '#63706b' }}>
          {new Date(document.visitDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC',
          })}{' '}
          · {document.reference}
        </p>
      </header>
      <section style={{ margin: '28px 0' }}>
        <h2>Your visit</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{document.visitSummary}</p>
      </section>
      <section style={{ margin: '28px 0' }}>
        <h2>Care received today</h2>
        {document.careOutcome === 'STARTED' ? (
          <ul style={{ paddingLeft: 24 }}>
            {document.careReceived.map((item, index) => (
              <li key={index} style={{ margin: '12px 0' }}>
                {item.name}
                {item.quantity > 1 ? ` × ${item.quantity}` : ''}{' '}
                <span style={{ color: '#63706b' }}>· Catalog price {priceLabel(item)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {document.careOutcome === 'NOT_STARTED'
              ? 'Care was not started at this visit.'
              : 'Your clinic is confirming the care outcome.'}
          </p>
        )}
      </section>
      <section style={{ margin: '28px 0' }}>
        <h2>Your wellness recommendations</h2>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{document.explanation}</p>
        {document.offers.map((item, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #dfece6',
              background: '#f6faf8',
              padding: 24,
              borderRadius: 16,
              marginTop: 16,
            }}
          >
            <div
              style={{
                display: 'flex',
                gap: 16,
                justifyContent: 'space-between',
                flexWrap: 'wrap',
              }}
            >
              <h3 style={{ margin: 0 }}>{item.name}</h3>
              <strong style={{ color: accent }}>{priceLabel(item)}</strong>
            </div>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{item.rationale}</p>
            {item.terms && (
              <p style={{ color: '#63706b', fontSize: 13, whiteSpace: 'pre-wrap' }}>
                Terms: {item.terms}
              </p>
            )}
          </div>
        ))}
        {!document.offers.length && <p>No additional services or memberships were recommended.</p>}
      </section>
      <footer style={{ paddingTop: 24, borderTop: '1px solid #e1ebe7' }}>
        {document.clinic.contact && (
          <p style={{ whiteSpace: 'pre-wrap' }}>{document.clinic.contact}</p>
        )}
        <p style={{ fontSize: 13, color: '#63706b' }}>
          Reviewed and approved by your clinic team. Suggestions describe options for discussion
          with your provider.
        </p>
        <a
          className="button primary"
          href={`/api/share/${encodeURIComponent(token)}/document`}
          download="wellness-visit.pdf"
        >
          Download your visit PDF
        </a>
        <p style={{ fontSize: 12, color: '#63706b', marginTop: 24 }}>{document.warning}</p>
      </footer>
    </article>
  );
}

export default async function SharedVisitPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    await validShare(token);
    let document: TakeawayDocument | null = null;
    try {
      document = await sharedDocument(token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
    }
    if (document)
      return (
        <main style={{ padding: '16px', minHeight: '100vh', background: '#eef4f0' }}>
          <VisitDocument document={document} token={token} />
        </main>
      );
    return (
      <main style={{ minHeight: '100vh', padding: '64px 24px', background: '#eef4f0' }}>
        <section
          style={{
            maxWidth: 480,
            margin: '0 auto',
            borderRadius: 24,
            padding: 32,
            background: '#fff',
          }}
        >
          <p style={{ color: '#0d9488', fontWeight: 700 }}>DripWell</p>
          <h1>Your private wellness visit</h1>
          <VerificationForm token={token} />
        </section>
      </main>
    );
  } catch (error) {
    const unavailable = error instanceof ApiError && error.status < 500;
    return (
      <main style={{ padding: '64px 24px' }}>
        <section style={{ maxWidth: 480, margin: '0 auto' }}>
          <h1>
            {unavailable
              ? 'This document is unavailable'
              : 'This document cannot be opened right now'}
          </h1>
          <p>
            {unavailable
              ? 'The share may have expired, been revoked, or changed after review. Ask your clinic for a fresh link.'
              : 'Please try again later or contact your clinic.'}
          </p>
        </section>
      </main>
    );
  }
}
