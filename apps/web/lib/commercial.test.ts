import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Stripe from 'stripe';
import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const database = vi.hoisted(() => ({ getDb: vi.fn(() => { throw new Error('Unexpected database access'); }) }));
vi.mock('./db', () => database);

import { assertPlatformPrice, platformSubscriptionTerms, starterCommercialTerms, starterReferralPolicy } from './commercial';
import { checkout, configuredPlatformPrice, platformSubscriptionOffer } from './billing';
import { SubscriptionTerms } from '../components/subscription-terms';

function price(): Stripe.Price {
  return {
    id: 'price_synthetic_commercial', object: 'price', active: true, currency: 'usd',
    unit_amount: 19900, unit_amount_decimal: Stripe.Decimal.from('19900'),
    type: 'recurring', billing_scheme: 'per_unit', custom_unit_amount: null, transform_quantity: null,
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed', meter: null, trial_period_days: null },
    product: { id: 'prod_synthetic_commercial', object: 'product', active: true },
  } as Stripe.Price;
}

function connectTestBoundary() {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_unit_boundary_no_network');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_unit_boundary_no_network');
  vi.stubEnv('STRIPE_PRICE_ID', 'price_synthetic_commercial');
  vi.stubEnv('PLATFORM_SUBSCRIPTION_CENTS', '');
  vi.stubEnv('PLATFORM_SUBSCRIPTION_CURRENCY', '');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  database.getDb.mockClear();
});

describe('Owner-delegated commercial configuration', () => {
  test('uses the canonical monthly account price and explicit starter referral terms', () => {
    expect(platformSubscriptionTerms({})).toEqual({
      amountCents: 19900, currency: 'USD', interval: 'month', intervalCount: 1, billingUnit: 'CLINIC_ACCOUNT',
    });
    expect(starterReferralPolicy(7)).toEqual({
      version: 7, creditCents: 5000, currency: 'USD', attributionDays: 30,
      qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION', refundReversesCredit: true, expiryDays: null,
    });
    const edited = starterReferralPolicy(8);
    edited.creditCents = 7000;
    expect(starterCommercialTerms.referral.creditCents).toBe(5000);
    expect(starterReferralPolicy(9).creditCents).toBe(5000);
  });

  test('preserves explicit future amount/currency overrides and blank defaults', () => {
    expect(platformSubscriptionTerms({ PLATFORM_SUBSCRIPTION_CENTS: ' 24900 ', PLATFORM_SUBSCRIPTION_CURRENCY: ' EUR ' }))
      .toMatchObject({ amountCents: 24900, currency: 'EUR' });
    expect(platformSubscriptionTerms({ PLATFORM_SUBSCRIPTION_CENTS: '', PLATFORM_SUBSCRIPTION_CURRENCY: ' ' }))
      .toEqual(platformSubscriptionTerms({}));
  });

  test.each(['0', '-1', '199.00', '1e4', 'NaN', '19900x', '2147483648', '9007199254740992'])('rejects invalid minor-unit override %s', amount => {
    expect(() => platformSubscriptionTerms({ PLATFORM_SUBSCRIPTION_CENTS: amount })).toThrow();
  });
  test.each(['usd', 'US', 'XYZ', 'USDextra'])('rejects invalid currency override %s', currency => {
    expect(() => platformSubscriptionTerms({ PLATFORM_SUBSCRIPTION_CURRENCY: currency })).toThrow();
  });
  test.each([0, -1, 1.5, 2147483648])('rejects unsupported referral version %s', version => {
    expect(() => starterReferralPolicy(version)).toThrow();
  });

  test('matches a real fixed monthly licensed price to the expected plan', () => {
    expect(() => assertPlatformPrice(price(), price().id, platformSubscriptionTerms({}))).not.toThrow();
    const overridden = price();
    overridden.currency = 'eur';
    overridden.unit_amount = 24900;
    overridden.unit_amount_decimal = Stripe.Decimal.from('24900');
    expect(() => assertPlatformPrice(overridden, overridden.id, platformSubscriptionTerms({
      PLATFORM_SUBSCRIPTION_CENTS: '24900', PLATFORM_SUBSCRIPTION_CURRENCY: 'EUR',
    }))).not.toThrow();
  });

  test.each([
    ['ID', (value: Stripe.Price) => { value.id = 'price_another'; }],
    ['inactive', (value: Stripe.Price) => { value.active = false; }],
    ['amount', (value: Stripe.Price) => { value.unit_amount = 9900; }],
    ['decimal amount', (value: Stripe.Price) => { value.unit_amount_decimal = Stripe.Decimal.from('19900.5'); }],
    ['currency', (value: Stripe.Price) => { value.currency = 'eur'; }],
    ['one time', (value: Stripe.Price) => { value.type = 'one_time'; value.recurring = null; }],
    ['yearly', (value: Stripe.Price) => { value.recurring!.interval = 'year'; }],
    ['quarterly', (value: Stripe.Price) => { value.recurring!.interval_count = 3; }],
    ['metered', (value: Stripe.Price) => { value.recurring!.usage_type = 'metered'; }],
    ['tiered', (value: Stripe.Price) => { value.billing_scheme = 'tiered'; }],
    ['custom amount', (value: Stripe.Price) => { value.custom_unit_amount = { minimum: 1000, maximum: null, preset: 19900 }; }],
    ['transformed quantity', (value: Stripe.Price) => { value.transform_quantity = { divide_by: 10, round: 'up' }; }],
    ['unexpanded product', (value: Stripe.Price) => { value.product = 'prod_unverified'; }],
    ['inactive product', (value: Stripe.Price) => { (value.product as Stripe.Product).active = false; }],
    ['deleted product', (value: Stripe.Price) => { value.product = { id: 'prod_deleted', object: 'product', deleted: true }; }],
  ] as const)('rejects a mismatched or unsupported price: %s', (_label, mutate) => {
    const candidate = price();
    mutate(candidate);
    expect(() => assertPlatformPrice(candidate, price().id, platformSubscriptionTerms({}))).toThrow();
  });
});

describe('Verified subscription offer and checkout preflight', () => {
  test('missing service configuration preserves visible plan terms without a provider read', async () => {
    connectTestBoundary();
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', '');
    const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve');
    const offer = await platformSubscriptionOffer();
    expect(offer).toMatchObject({ checkoutReady: false, terms: { amountCents: 19900, currency: 'USD' } });
    expect(offer.notice).toContain('No automatic paid enrollment');
    expect(retrieve).not.toHaveBeenCalled();
    await expect(checkout('synthetic-no-db', 'synthetic@example.test')).rejects.toMatchObject({ status: 503, code: 'BILLING_UNAVAILABLE' });
    expect(database.getDb).not.toHaveBeenCalled();
  });

  test('price verification fetches the configured ID with expanded product and returns safe terms', async () => {
    connectTestBoundary();
    const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockResolvedValue(price() as Stripe.Response<Stripe.Price>);
    const offer = await platformSubscriptionOffer();
    expect(offer).toMatchObject({ checkoutReady: true, terms: { amountCents: 19900, currency: 'USD' } });
    expect(retrieve).toHaveBeenCalledWith('price_synthetic_commercial', { expand: ['product'] });
    expect(offer).not.toHaveProperty('priceId');
    expect(database.getDb).not.toHaveBeenCalled();
  });

  test('a price mismatch blocks checkout before customer, credit or database side effects', async () => {
    connectTestBoundary();
    const wrong = price();
    wrong.unit_amount = 29900;
    vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockResolvedValue(wrong as Stripe.Response<Stripe.Price>);
    await expect(checkout('synthetic-no-db', 'synthetic@example.test')).rejects.toMatchObject({ status: 503, code: 'BILLING_PRICE_MISMATCH' });
    expect((await platformSubscriptionOffer()).checkoutReady).toBe(false);
    expect(database.getDb).not.toHaveBeenCalled();
  });

  test('invalid explicit terms do not trigger a price read or misrepresent a price', async () => {
    connectTestBoundary();
    vi.stubEnv('PLATFORM_SUBSCRIPTION_CENTS', '0');
    const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve');
    expect(await platformSubscriptionOffer()).toMatchObject({ terms: null, checkoutReady: false });
    await expect(configuredPlatformPrice()).rejects.toMatchObject({ status: 503, code: 'BILLING_TERMS_INVALID' });
    expect(retrieve).not.toHaveBeenCalled();
  });

  test('provider unavailability does not hide the plan or leak provider error details', async () => {
    connectTestBoundary();
    vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockRejectedValue(new Error('private provider details'));
    const offer = await platformSubscriptionOffer();
    expect(offer).toMatchObject({ checkoutReady: false, terms: { amountCents: 19900 } });
    expect(offer.notice).toContain('trial and existing visits remain available');
    expect(offer.notice).not.toContain('private provider details');
  });

  test('the shared owner/admin presentation renders configured terms and the availability notice', () => {
    const html = renderToStaticMarkup(createElement(SubscriptionTerms, {
      offer: { terms: platformSubscriptionTerms({}), checkoutReady: false, notice: 'No automatic paid enrollment.' },
    }));
    expect(html).toContain('$199.00');
    expect(html).toContain('per clinic account/month');
    expect(html).toContain('No automatic paid enrollment.');
    const invalid = renderToStaticMarkup(createElement(SubscriptionTerms, {
      offer: { terms: null, checkoutReady: false, notice: 'Subscription terms need configuration.' },
    }));
    expect(invalid).not.toContain('$199');
    expect(invalid).toContain('Subscription terms need configuration.');
  });
});
