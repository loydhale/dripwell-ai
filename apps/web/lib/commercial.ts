import type Stripe from 'stripe';
import { isSupportedCurrency, referralPolicySchema, type ReferralPolicy } from '@dripwell/shared/v2';

/** Owner-delegated starter terms. Loading them never activates billing or rewards. */
export const starterCommercialTerms = {
  subscription: {
    amountCents: 19900,
    currency: 'USD',
    interval: 'month',
    intervalCount: 1,
    billingUnit: 'CLINIC_ACCOUNT',
  },
  referral: {
    creditCents: 5000,
    currency: 'USD',
    attributionDays: 30,
    qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION',
    refundReversesCredit: true,
    expiryDays: null,
  },
} as const;

export interface PlatformSubscriptionTerms {
  amountCents: number;
  currency: string;
  interval: 'month';
  intervalCount: 1;
  billingUnit: 'CLINIC_ACCOUNT';
}

export interface PlatformSubscriptionOffer {
  terms: PlatformSubscriptionTerms | null;
  checkoutReady: boolean;
  notice: string;
}

export interface CommercialEnvironment {
  readonly [name: string]: string | undefined;
  PLATFORM_SUBSCRIPTION_CENTS?: string;
  PLATFORM_SUBSCRIPTION_CURRENCY?: string;
}

/** Server configuration is explicit; blank overrides retain the starter values. */
export function platformSubscriptionTerms(env: CommercialEnvironment): PlatformSubscriptionTerms {
  const amount = env.PLATFORM_SUBSCRIPTION_CENTS?.trim();
  const currency = env.PLATFORM_SUBSCRIPTION_CURRENCY?.trim() || starterCommercialTerms.subscription.currency;
  const amountCents = amount ? Number(amount) : starterCommercialTerms.subscription.amountCents;
  if ((amount && !/^\d+$/.test(amount)) || !Number.isSafeInteger(amountCents) || amountCents <= 0 ||
      amountCents > 2147483647 || !isSupportedCurrency(currency)) {
    throw new Error('The platform subscription amount or currency is invalid.');
  }
  return { ...starterCommercialTerms.subscription, amountCents, currency };
}

/** Checkout uses the selected provider price, never a browser-supplied amount. */
export function assertPlatformPrice(price: Stripe.Price, priceId: string, terms: PlatformSubscriptionTerms): void {
  const product = price.product;
  if (price.id !== priceId || price.object !== 'price' || price.active !== true ||
      price.type !== 'recurring' || price.billing_scheme !== 'per_unit' ||
      price.recurring?.interval !== terms.interval || price.recurring.interval_count !== terms.intervalCount ||
      price.recurring.usage_type !== 'licensed' || price.currency !== terms.currency.toLowerCase() ||
      price.unit_amount !== terms.amountCents ||
      (price.unit_amount_decimal != null && Number(price.unit_amount_decimal.toString()) !== terms.amountCents) ||
      price.custom_unit_amount !== null || price.transform_quantity !== null ||
      typeof product !== 'object' || product === null || ('deleted' in product && product.deleted) ||
      !('active' in product) || product.active !== true) {
    throw new Error('The configured Stripe price does not match the platform subscription terms.');
  }
}

export function starterReferralPolicy(version: number): ReferralPolicy {
  if (!Number.isSafeInteger(version) || version <= 0 || version > 2147483647)
    throw new Error('A new supported referral policy version is required.');
  return referralPolicySchema.parse({ ...starterCommercialTerms.referral, version });
}
