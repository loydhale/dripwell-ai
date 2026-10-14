import { formatMoney } from '@dripwell/shared/v2';

export interface WellnessOfferContent {
  name: string;
  rationale: string;
  quantity: number;
  priceCents: number;
  currency: string;
  terms: string;
  benefits?: string[];
  matchedGoals?: string[];
}

export function WellnessOffer({ offer }: { offer: WellnessOfferContent }) {
  return (
    <section aria-label={offer.name}>
      <h3>{offer.name}</h3>
      {offer.matchedGoals?.length ? (
        <div>
          <h4>Goals you discussed</h4>
          <ul>{offer.matchedGoals.map((goal, index) => <li key={index}>{goal}</li>)}</ul>
        </div>
      ) : null}
      <p style={{ whiteSpace: 'pre-wrap' }}><strong>Why it fits: </strong>{offer.rationale}</p>
      {offer.benefits?.length ? (
        <div>
          <h4>Included by your clinic</h4>
          <ul>{offer.benefits.map((benefit, index) => <li key={index}>{benefit}</li>)}</ul>
        </div>
      ) : null}
      <p><strong>Total official price: </strong>{formatMoney(offer.priceCents * offer.quantity, offer.currency)} {offer.currency}</p>
      {offer.terms ? <p style={{ whiteSpace: 'pre-wrap' }}><strong>Clinic terms: </strong>{offer.terms}</p> : null}
      <p>Optional. Ask your clinic about this option if it interests you.</p>
    </section>
  );
}
