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
  STRIPE_PRICE_ID?: string;
  STRIPE_PRICE_HISTORY?: string;
}

export interface RetainedPlatformPrice {
  priceId: string;
  productId: string;
  amountCents: number;
  currency: string;
  interval: 'month';
  intervalCount: 1;
}

/** Explicit server authorization for old subscriptions, never a checkout menu. */
export function platformPriceHistory(env: CommercialEnvironment): RetainedPlatformPrice[] {
  const raw = env.STRIPE_PRICE_HISTORY?.trim();
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Price history must be an array.');
  const fields = ['priceId', 'productId', 'amountCents', 'currency', 'interval', 'intervalCount'];
  const seen = new Set<string>();
  return parsed.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('A retained price contract is required.');
    const data = value as Record<string, unknown>;
    const keys = Object.keys(data);
    const { priceId, productId, amountCents, currency, interval, intervalCount } = data;
    if (keys.length !== fields.length || keys.some(key => !fields.includes(key)) ||
        typeof priceId !== 'string' || !/^price_[A-Za-z0-9]+$/.test(priceId) ||
        typeof productId !== 'string' || !/^prod_[A-Za-z0-9]+$/.test(productId) ||
        typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2147483647 ||
        typeof currency !== 'string' || !isSupportedCurrency(currency) || interval !== 'month' || intervalCount !== 1 ||
        priceId === env.STRIPE_PRICE_ID?.trim() || seen.has(priceId)) {
      throw new Error('The retained price contracts are invalid or ambiguous.');
    }
    seen.add(priceId);
    return { priceId, productId, amountCents, currency, interval, intervalCount };
  });
}

/** Archived availability does not change a specifically retained billing contract. */
export function matchesRetainedPlatformPrice(price: Stripe.Price, contract: RetainedPlatformPrice): boolean {
  const product = price.product;
  const productId = typeof product === 'string' ? product : product?.id;
  const decimal = price.unit_amount_decimal;
  return price.id === contract.priceId && price.object === 'price' && price.deleted === undefined &&
    typeof price.active === 'boolean' && productId === contract.productId &&
    !(typeof product === 'object' && product !== null && 'deleted' in product && product.deleted) &&
    price.type === 'recurring' && price.billing_scheme === 'per_unit' &&
    price.recurring?.interval === contract.interval && price.recurring.interval_count === contract.intervalCount &&
    price.recurring.usage_type === 'licensed' && price.currency === contract.currency.toLowerCase() &&
    price.unit_amount === contract.amountCents &&
    (decimal == null || new RegExp(`^${contract.amountCents}(?:\\.0{1,12})?$`).test(decimal.toString())) &&
    price.custom_unit_amount === null && price.transform_quantity === null;
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
