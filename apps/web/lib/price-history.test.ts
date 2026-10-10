import Stripe from 'stripe';
import { afterEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const database = vi.hoisted(() => ({ getDb: vi.fn(() => { throw new Error('Unexpected database access'); }) }));
vi.mock('./db', () => database);
import { matchesRetainedPlatformPrice, platformPriceHistory, type RetainedPlatformPrice } from './commercial';
import { checkout, configuredPlatformPrice, platformSubscriptionOffer } from './billing';

const contract: RetainedPlatformPrice = {
  priceId: 'price_Old123', productId: 'prod_Plan123', amountCents: 9000,
  currency: 'USD', interval: 'month', intervalCount: 1,
};
function price(saved = contract): Stripe.Price {
  return {
    id: saved.priceId, object: 'price', active: false, product: saved.productId,
    type: 'recurring', billing_scheme: 'per_unit', currency: saved.currency.toLowerCase(),
    unit_amount: saved.amountCents, unit_amount_decimal: Stripe.Decimal.from(String(saved.amountCents)),
    recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed', meter: null, trial_period_days: null },
    custom_unit_amount: null, transform_quantity: null,
  } as Stripe.Price;
}
function environment(raw = JSON.stringify([contract])) {
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_history_unit_transport_fixture');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_history_unit_transport_fixture');
  vi.stubEnv('STRIPE_PRICE_ID', 'price_Current456');
  vi.stubEnv('STRIPE_PRICE_HISTORY', raw);
  vi.stubEnv('PLATFORM_SUBSCRIPTION_CENTS', '');
  vi.stubEnv('PLATFORM_SUBSCRIPTION_CURRENCY', '');
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); database.getDb.mockClear(); });

describe('Explicit retained platform price contracts', () => {
  test('blank history grants no additional contracts and parsing does not change current terms', () => {
    expect(platformPriceHistory({})).toEqual([]);
    expect(platformPriceHistory({ STRIPE_PRICE_HISTORY: ' ' })).toEqual([]);
    expect(platformPriceHistory({ STRIPE_PRICE_ID: 'price_Current456', STRIPE_PRICE_HISTORY: JSON.stringify([contract]) })).toEqual([contract]);
    const parsed = platformPriceHistory({ STRIPE_PRICE_HISTORY: JSON.stringify([contract]) });
    parsed[0].amountCents = 10000;
    expect(contract.amountCents).toBe(9000);
  });
  test.each(['{', '{}', 'null', '[null]', '[[]]', '[true]'])('rejects malformed or noncontract history %s', raw => {
    expect(() => platformPriceHistory({ STRIPE_PRICE_HISTORY: raw })).toThrow();
  });
  test.each([
    { ...contract, amountCents: 0 }, { ...contract, amountCents: -1 }, { ...contract, amountCents: 9000.5 },
    { ...contract, amountCents: 2147483648 }, { ...contract, amountCents: '+9000' },
    { ...contract, amountCents: '9e3' }, { ...contract, amountCents: ' 9000 ' },
    { ...contract, currency: 'usd' }, { ...contract, currency: 'XYZ' },
    { ...contract, priceId: 'price_*' }, { ...contract, productId: 'prod_ ' },
    { ...contract, interval: 'year' }, { ...contract, intervalCount: 3 }, { ...contract, extra: true },
  ])('rejects unsupported or coercible contract fields %#', value => {
    expect(() => platformPriceHistory({ STRIPE_PRICE_HISTORY: JSON.stringify([value]) })).toThrow();
  });
  test('rejects missing fields, duplicate IDs, conflicting contracts and a current/history overlap', () => {
    const { productId: _missing, ...incomplete } = contract;
    for (const values of [[incomplete], [contract, contract], [contract, { ...contract, amountCents: 9900 }]]) {
      expect(() => platformPriceHistory({ STRIPE_PRICE_HISTORY: JSON.stringify(values) })).toThrow();
    }
    expect(() => platformPriceHistory({ STRIPE_PRICE_ID: contract.priceId, STRIPE_PRICE_HISTORY: JSON.stringify([contract]) })).toThrow();
    expect(() => platformPriceHistory({ STRIPE_PRICE_ID: ` ${contract.priceId} `, STRIPE_PRICE_HISTORY: JSON.stringify([contract]) })).toThrow();
  });
  test('ordinary JSON numeric notation resolves to its integer value without accepting string coercion', () => {
    const raw = JSON.stringify([contract]).replace('"amountCents":9000', '"amountCents":9e3');
    expect(platformPriceHistory({ STRIPE_PRICE_HISTORY: raw })).toEqual([contract]);
  });
  test('archived price and product availability do not invalidate an explicitly saved contract', () => {
    expect(matchesRetainedPlatformPrice(price(), contract)).toBe(true);
    const expanded = price();
    expanded.product = { id: contract.productId, object: 'product', active: false } as Stripe.Product;
    expect(matchesRetainedPlatformPrice(expanded, contract)).toBe(true);
    expanded.active = true;
    expect(matchesRetainedPlatformPrice(expanded, contract)).toBe(true);
  });
  test('retained decimal verification rejects a fraction that Number would round away', () => {
    const saved = { ...contract, amountCents: 99999999 };
    const value = price(saved);
    value.unit_amount_decimal = '99999999.000000000001' as unknown as Stripe.Decimal;
    expect(Number(value.unit_amount_decimal.toString())).toBe(saved.amountCents);
    expect(matchesRetainedPlatformPrice(value, saved)).toBe(false);
    value.unit_amount_decimal = '99999999.000000000000' as unknown as Stripe.Decimal;
    expect(matchesRetainedPlatformPrice(value, saved)).toBe(true);
  });
  test.each(['9000', '9000.0', '9000.000000000000'])('accepts exact integer or zero-fraction provider decimal %s', decimal => {
    const value = price(); value.unit_amount_decimal = decimal as unknown as Stripe.Decimal;
    expect(matchesRetainedPlatformPrice(value, contract)).toBe(true);
  });
  test.each(['+9000', '9e3', ' 9000 ', '9000.000000000001', '9000.0000000000000', 'NaN', 'Infinity'])('rejects unsupported provider decimal spelling %s', decimal => {
    const value = price(); value.unit_amount_decimal = decimal as unknown as Stripe.Decimal;
    expect(matchesRetainedPlatformPrice(value, contract)).toBe(false);
  });
  test('price identity, deleted product and fixed original monetary contract are required', () => {
    const value = price();
    value.product = { id: contract.productId, object: 'product', deleted: true };
    expect(matchesRetainedPlatformPrice(value, contract)).toBe(false);
    expect(matchesRetainedPlatformPrice(price({ ...contract, productId: 'prod_Other123' }), contract)).toBe(false);
    expect(matchesRetainedPlatformPrice(price({ ...contract, amountCents: 9900 }), contract)).toBe(false);
    expect(matchesRetainedPlatformPrice(price({ ...contract, currency: 'CAD' }), contract)).toBe(false);
  });
});

describe('Retained-price checkout preflight', () => {
  test.each(['{', JSON.stringify([contract, contract]), JSON.stringify([{ ...contract, priceId: 'price_Current456' }])])(
    'invalid history fails before price customer credit session or database side effects %#', async raw => {
      environment(raw);
      const unexpected = new Error('Unexpected provider call');
      const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockRejectedValue(unexpected);
      const customer = vi.spyOn(Stripe.resources.Customers.prototype, 'create').mockRejectedValue(unexpected);
      const credit = vi.spyOn(Stripe.resources.Customers.prototype, 'createBalanceTransaction').mockRejectedValue(unexpected);
      const sdk = new Stripe('sk_test_history_unit_transport_fixture');
      const sessions = Object.getPrototypeOf(sdk.checkout.sessions) as typeof sdk.checkout.sessions;
      const session = vi.spyOn(sessions, 'create').mockRejectedValue(unexpected);
      await expect(checkout('synthetic-no-db', 'synthetic@example.test')).rejects.toMatchObject({ status: 503, code: 'BILLING_PRICE_HISTORY_INVALID' });
      expect(await platformSubscriptionOffer()).toMatchObject({ checkoutReady: false, terms: { amountCents: 19900, currency: 'USD' } });
      expect(retrieve).not.toHaveBeenCalled(); expect(customer).not.toHaveBeenCalled();
      expect(credit).not.toHaveBeenCalled(); expect(session).not.toHaveBeenCalled(); expect(database.getDb).not.toHaveBeenCalled();
    },
  );
  test('valid history cannot substitute a retired price for the current verified checkout offer', async () => {
    environment();
    const current = price({ ...contract, priceId: 'price_Current456', amountCents: 19900 });
    current.active = true;
    current.product = { id: contract.productId, object: 'product', active: true } as Stripe.Product;
    const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockResolvedValue(current as Stripe.Response<Stripe.Price>);
    expect((await configuredPlatformPrice()).id).toBe('price_Current456');
    expect(retrieve).toHaveBeenCalledWith('price_Current456', { expand: ['product'] });
    const retired = price();
    retired.product = current.product;
    retrieve.mockResolvedValue(retired as Stripe.Response<Stripe.Price>);
    await expect(checkout('synthetic-no-db', 'synthetic@example.test')).rejects.toMatchObject({ status: 503, code: 'BILLING_PRICE_MISMATCH' });
    expect(database.getDb).not.toHaveBeenCalled();
  });
});
