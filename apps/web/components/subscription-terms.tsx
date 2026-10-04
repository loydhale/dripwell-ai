'use client';

import type { PlatformSubscriptionOffer } from '@/lib/commercial';
import { Money } from './ui';

export function SubscriptionTerms({ offer }: { offer: PlatformSubscriptionOffer }) {
  return (
    <div>
      {offer.terms ? (
        <p>
          New subscription: <Money cents={offer.terms.amountCents} currency={offer.terms.currency} />{' '}
          per clinic account/month
        </p>
      ) : null}
      <p className="field-help">{offer.notice}</p>
    </div>
  );
}
