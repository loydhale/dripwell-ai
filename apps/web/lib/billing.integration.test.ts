import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { getDb } from './db';
import { applyCredits, checkout, processBillingEvent } from './billing';
import { POST as webhook } from '../app/api/billing/webhook/route';

const run = Boolean(process.env.TEST_DATABASE_URL);
if (run) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const suite = run ? describe : describe.skip;
const prefix = `growth-${randomUUID()}`;
const ownedTenants: string[] = [];
const eventIds: string[] = [];
const now = Math.floor(Date.now() / 1000);
function event(type: string, object: unknown): Stripe.Event {
  const id = `evt_${prefix}_${eventIds.length}`;
  eventIds.push(id);
  return {
    id,
    object: 'event',
    type,
    created: now,
    data: { object },
    livemode: false,
    api_version: Stripe.API_VERSION,
    pending_webhooks: 1,
    request: null,
  } as unknown as Stripe.Event;
}
async function* stream<T>(values: T[]) {
  for (const value of values) yield value;
}

suite('subscription and referral persistence against isolated PostgreSQL', () => {
  let referrerId: string;
  let referredId: string;
  let referralId: string;
  let customerId: string;
  let subscriptionId: string;
  let invoiceId: string;
  let priceId: string;
  let productId: string;
  let itemId: string;
  let providerSubscription: Stripe.Subscription;
  function paidSubscription(status = 'active', periodEnd = now + 30 * 86400): Stripe.Subscription {
    return {
      id: subscriptionId, customer: customerId, status, metadata: { tenantId: referredId },
      items: { data: [{ id: itemId, quantity: 1, current_period_end: periodEnd,
        price: { id: priceId, product: productId, type: 'recurring', recurring: { interval: 'month' }, unit_amount: 9000, currency: 'usd' },
      }] },
    } as unknown as Stripe.Subscription;
  }
  function paidInvoice(id = invoiceId, amountPaid = 9000, periodEnd = now + 30 * 86400): unknown {
    return {
      id, customer: customerId, parent: { subscription_details: { subscription: subscriptionId } },
      amount_paid: amountPaid, amount_remaining: 0, currency: 'usd', status: 'paid', created: now,
      amount_due: amountPaid, total: 9000, starting_balance: amountPaid === 0 ? -9000 : 0,
      status_transitions: { paid_at: now },
      lines: { has_more: false, data: [{ id: `il_${id}`, amount: 9000, currency: 'usd', quantity: 1,
        parent: { type: 'subscription_item_details', subscription_item_details: { subscription: subscriptionId, subscription_item: itemId } },
        pricing: { type: 'price_details', price_details: { price: priceId, product: productId } },
        period: { start: now, end: periodEnd },
      }] },
    };
  }
  const stripe = new Stripe('sk_test_disposable_verification');
  async function signedDelivery(fixture: Stripe.Event): Promise<Response> {
    const body = JSON.stringify(fixture);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    return webhook(new Request('https://example.test/api/billing/webhook', {
      method: 'POST', body, headers: { 'stripe-signature': signature },
    }), undefined);
  }
  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_disposable_verification';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_disposable_verification';
    const db = getDb();
    const referrer = await db.tenant.create({
      data: {
        name: 'Synthetic referral clinic',
        slug: `${prefix}-a`,
        state: 'TX',
        medicalDirector: 'Synthetic fixture',
      },
    });
    const referred = await db.tenant.create({
      data: {
        name: 'Synthetic referred clinic',
        slug: `${prefix}-b`,
        state: 'TX',
        medicalDirector: 'Synthetic fixture',
      },
    });
    ownedTenants.push(referrer.id, referred.id);
    referrerId = referrer.id;
    referredId = referred.id;
    customerId = `cus_${prefix}`;
    subscriptionId = `sub_${prefix}`;
    invoiceId = `in_${prefix}`;
    priceId = `price_${prefix}`; productId = `prod_${prefix}`; itemId = `si_${prefix}`;
    process.env.STRIPE_PRICE_ID = priceId;
    providerSubscription = paidSubscription();
    await db.subscription.create({
      data: {
        tenantId: referrerId,
        status: 'TRIAL',
        trialActivatedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
      },
    });
    await db.subscription.create({
      data: {
        tenantId: referredId,
        status: 'TRIAL',
        stripeCustomerId: customerId,
        trialActivatedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 86400000),
        trialUsed: 3,
      },
    });
    const referral = await db.referral.create({
      data: {
        referrerTenantId: referrerId,
        referredTenantId: referredId,
        code: prefix,
        policyVersion: 1,
        policySnapshot: {
          version: 1,
          creditCents: 2500,
          currency: 'USD',
          attributionDays: 30,
          qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION',
          refundReversesCredit: true,
          expiryDays: null,
        },
      },
    });
    referralId = referral.id;
    vi.spyOn(Stripe.resources.Subscriptions.prototype, 'retrieve').mockImplementation(async () => providerSubscription as Stripe.Response<Stripe.Subscription>);
  });
  afterAll(async () => {
    const db = getDb();
    await db.creditLedger.deleteMany({ where: { tenantId: { in: ownedTenants } } });
    await db.referral.deleteMany({ where: { referrerTenantId: { in: ownedTenants } } });
    await db.billingEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await db.tenant.deleteMany({ where: { id: { in: ownedTenants } } });
    vi.restoreAllMocks();
    await db.$disconnect();
  });
  test('rejects forged Stripe signatures before business writes', async () => {
    const body = JSON.stringify(event('test.unknown', {}));
    const response = await webhook(
      new Request('https://example.test/api/billing/webhook', {
        method: 'POST',
        body,
        headers: { 'stripe-signature': 't=1,v1=forged' },
      }),
      undefined,
    );
    expect(response.status).toBe(400);
    expect(await getDb().billingEvent.count({ where: { eventId: eventIds.at(-1) } })).toBe(0);
  });
  test('verifies signed raw payloads and consumes duplicate webhook IDs once', async () => {
    const fixture = event('test.unknown', { id: 'safe-metadata-only' });
    const body = JSON.stringify(fixture);
    const signature = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
    for (let i = 0; i < 2; i++) {
      const response = await webhook(
        new Request('https://example.test/api/billing/webhook', {
          method: 'POST',
          body,
          headers: { 'stripe-signature': signature },
        }),
        undefined,
      );
      expect(response.status).toBe(200);
    }
    expect(
      await getDb().billingEvent.count({ where: { eventId: fixture.id, status: 'PROCESSED' } }),
    ).toBe(1);
  });
  test('does not grant paid access from an active subscription event before payment', async () => {
    await processBillingEvent(event('customer.subscription.created', paidSubscription()));
    const local = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } });
    expect(local.status).toBe('TRIAL');
    expect(local.stripeStatus).toBe('ACTIVE');
    expect(local.trialUsed).toBe(3);
  });
  test('free, trial, unrelated-price, and wrong-tenant invoices cannot activate paid access', async () => {
    providerSubscription = paidSubscription('trialing');
    await processBillingEvent(event('invoice.paid', paidInvoice(`${invoiceId}_trial`, 0)));
    providerSubscription = paidSubscription();
    providerSubscription.items.data[0].price.unit_amount = 0;
    providerSubscription.items.data[0].price.unit_amount_decimal = Stripe.Decimal.zero;
    await processBillingEvent(event('invoice.paid', paidInvoice(`${invoiceId}_free`, 0)));
    providerSubscription = paidSubscription();
    const unrelated = paidInvoice(`${invoiceId}_unrelated`, 0) as Stripe.Invoice;
    unrelated.lines.data[0].pricing!.price_details!.price = 'price_unrelated';
    await processBillingEvent(event('invoice.paid', unrelated));
    providerSubscription = paidSubscription();
    providerSubscription.metadata.tenantId = referrerId;
    await processBillingEvent(event('invoice.paid', paidInvoice(`${invoiceId}_wrongtenant`, 0)));
    providerSubscription = paidSubscription();
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
    expect((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } })).status).toBe('TRIAL');
  });
  test('a verified active paid plan settled by account credit grants access without a referral reward', async () => {
    const before = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } });
    const response = await signedDelivery(event('invoice.paid', paidInvoice(`${invoiceId}_balance`, 0)));
    expect(response.status).toBe(200);
    const local = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } });
    expect(local.status).toBe('ACTIVE');
    expect(local.currentPeriodEnd!.getTime()).toBe((now + 30 * 86400) * 1000);
    expect(local.trialUsed).toBe(3);
    expect(local.trialActivatedAt).toEqual(before.trialActivatedAt);
    expect(local.trialEndsAt).toEqual(before.trialEndsAt);
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
    expect((await getDb().referral.findUniqueOrThrow({ where: { id: referralId } })).convertedAt).toBeNull();
  });
  test('first paid conversion earns one credit across distinct replayed payment events', async () => {
    const invoice = paidInvoice();
    await Promise.all([
      processBillingEvent(event('invoice.paid', invoice)),
      processBillingEvent(event('invoice.paid', invoice)),
    ]);
    const credits = await getDb().creditLedger.findMany({ where: { referralId, kind: 'EARNED' } });
    expect(credits).toHaveLength(1);
    expect(credits[0].amountCents).toBe(2500);
    const local = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } });
    expect(local.status).toBe('ACTIVE');
    expect(local.trialUsed).toBe(3);
    expect(local.trialLimit).toBe(10);
  });
  test('a discounted settled renewal restores access without new credits or trial resets', async () => {
    const nextPeriod = now + 60 * 86400;
    providerSubscription = paidSubscription('active', nextPeriod);
    await getDb().subscription.update({ where: { tenantId: referredId }, data: { status: 'PAST_DUE', currentPeriodEnd: new Date((now - 1) * 1000) } });
    const discounted = paidInvoice(`${invoiceId}_discounted`, 0, nextPeriod) as Stripe.Invoice;
    discounted.total = 0;
    expect((await signedDelivery(event('invoice.paid', discounted))).status).toBe(200);
    const restored = await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } });
    expect(restored.status).toBe('ACTIVE');
    expect(restored.currentPeriodEnd!.getTime()).toBe(nextPeriod * 1000);
    expect(restored.trialUsed).toBe(3);
    expect(await getDb().creditLedger.count({ where: { referralId, kind: 'EARNED' } })).toBe(1);
    await processBillingEvent(event('customer.subscription.updated', paidSubscription('active', now + 90 * 86400)));
    expect((await getDb().subscription.findUniqueOrThrow({ where: { tenantId: referredId } })).currentPeriodEnd!.getTime()).toBe(nextPeriod * 1000);
    providerSubscription = paidSubscription();
  });
  test('serializes credit application and reverses a refunded qualifying invoice once', async () => {
    await getDb().subscription.update({
      where: { tenantId: referrerId },
      data: { stripeCustomerId: `cus_referrer_${prefix}` },
    });
    const external: Array<{ id: string; metadata: { ledgerId: string; operation: string } }> = [];
    vi.spyOn(Stripe.resources.Customers.prototype, 'listBalanceTransactions').mockImplementation(
      () => stream(external) as unknown as Stripe.ApiListPromise<Stripe.CustomerBalanceTransaction>,
    );
    const create = vi
      .spyOn(Stripe.resources.Customers.prototype, 'createBalanceTransaction')
      .mockImplementation(async (_id, params) => {
        const transaction = {
          id: `cbtxn_${prefix}_${external.length}`,
          metadata: params.metadata as { ledgerId: string; operation: string },
        };
        external.push(transaction);
        return transaction as unknown as Stripe.Response<Stripe.CustomerBalanceTransaction>;
      });
    await Promise.all([applyCredits(referrerId), applyCredits(referrerId)]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(await getDb().creditLedger.count({ where: { referralId, kind: 'APPLIED' } })).toBe(1);
    vi.spyOn(Stripe.resources.InvoicePayments.prototype, 'list').mockImplementation(
      () =>
        stream([{ invoice: invoiceId }]) as unknown as Stripe.ApiListPromise<Stripe.InvoicePayment>,
    );
    const refund = { id: `ch_${prefix}`, amount_refunded: 9000, payment_intent: `pi_${prefix}` };
    await processBillingEvent(event('charge.refunded', refund));
    await processBillingEvent(event('charge.refunded', refund));
    expect(create).toHaveBeenCalledTimes(2);
    expect(await getDb().creditLedger.count({ where: { referralId, kind: 'REVERSED' } })).toBe(1);
    expect((await getDb().referral.findUniqueOrThrow({ where: { id: referralId } })).status).toBe(
      'REVERSED',
    );
  });
  test('reuses one checkout session across concurrent subscription starts', async () => {
    process.env.APP_URL = 'https://dripwell.example.test';
    process.env.STRIPE_PRICE_ID = `price_${prefix}`;
    vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockResolvedValue({
      id: `price_${prefix}`, object: 'price', active: true, currency: 'usd', unit_amount: 19900,
      unit_amount_decimal: Stripe.Decimal.from('19900'), type: 'recurring', billing_scheme: 'per_unit',
      recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed' },
      custom_unit_amount: null, transform_quantity: null,
      product: { id: `prod_${prefix}`, object: 'product', active: true },
    } as Stripe.Response<Stripe.Price>);
    vi.spyOn(Stripe.resources.Customers.prototype, 'create').mockResolvedValue({
      id: `cus_checkout_${prefix}`,
    } as Stripe.Response<Stripe.Customer>);
    const sessions: Stripe.Checkout.Session[] = [];
    const sessionPrototype = Object.getPrototypeOf(
      stripe.checkout.sessions,
    ) as typeof stripe.checkout.sessions;
    vi.spyOn(Stripe.resources.Subscriptions.prototype, 'list').mockImplementation(
      () => stream([]) as unknown as Stripe.ApiListPromise<Stripe.Subscription>,
    );
    vi.spyOn(sessionPrototype, 'list').mockImplementation(
      () => stream(sessions) as unknown as Stripe.ApiListPromise<Stripe.Checkout.Session>,
    );
    const create = vi.spyOn(sessionPrototype, 'create').mockImplementation(async (params) => {
      const session = {
        id: `cs_${prefix}`,
        client_reference_id: params!.client_reference_id,
        metadata: params!.metadata,
        url: 'https://checkout.stripe.com/synthetic-checkout',
      } as unknown as Stripe.Checkout.Session;
      sessions.push(session);
      return session as Stripe.Response<Stripe.Checkout.Session>;
    });
    const result = await Promise.all([
      checkout(referrerId, 'synthetic-owner@example.test'),
      checkout(referrerId, 'synthetic-owner@example.test'),
    ]);
    expect(create).toHaveBeenCalledTimes(1);
    expect(result[0].url).toBe(result[1].url);
  });
});
