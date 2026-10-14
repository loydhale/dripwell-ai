import { randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { getDb } from './db';
import { checkout, processBillingEvent } from './billing';
import { POST as webhook } from '../app/api/billing/webhook/route';

const run = Boolean(process.env.TEST_DATABASE_URL);
if (run) {
  const target = new URL(process.env.TEST_DATABASE_URL!);
  const ownedLocal = target.hostname === '127.0.0.1' && target.port === '55432' && target.pathname === '/dripwell_task042_verification';
  const disposableCi = target.hostname === 'localhost' && target.port === '5432' && target.pathname === '/dripwell_verification';
  if (!['postgres:', 'postgresql:'].includes(target.protocol) || (!ownedLocal && !disposableCi) || process.env.ALLOW_REAL_CLIENT_DATA !== 'false')
    throw new Error('Retained-price checks require the approved owned local or disposable CI database and the false data gate.');
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
const suite = run ? describe : describe.skip;
const stripe = new Stripe('sk_test_retained_price_transport_fixture');
async function* stream<T>(values: T[]) { for (const value of values) yield value; }

suite('retained platform price persistence against isolated PostgreSQL', () => {
  let token: string;
  let referrerId: string;
  let tenantId: string;
  let referralId: string;
  let customerId: string;
  let subscriptionId: string;
  let itemId: string;
  let priceId: string;
  let currentPriceId: string;
  let productId: string;
  let now: number;
  let providerSubscription: Stripe.Subscription;
  const eventIds: string[] = [];
  const tenantIds: string[] = [];
  const policy = {
    version: 3, creditCents: 2500, currency: 'USD', attributionDays: 30,
    qualification: 'FIRST_PAID_PLATFORM_SUBSCRIPTION', refundReversesCredit: true, expiryDays: null,
  };
  function history() {
    return [{ priceId, productId, amountCents: 9000, currency: 'USD', interval: 'month', intervalCount: 1 }];
  }
  function price(id = priceId, amount = 9000, active = false): Stripe.Price {
    return {
      id, object: 'price', active, product: productId, type: 'recurring', billing_scheme: 'per_unit',
      currency: 'usd', unit_amount: amount, unit_amount_decimal: Stripe.Decimal.from(String(amount)),
      recurring: { interval: 'month', interval_count: 1, usage_type: 'licensed', meter: null, trial_period_days: null },
      custom_unit_amount: null, transform_quantity: null,
    } as Stripe.Price;
  }
  function subscription(status = 'active', end = now + 30 * 86400): Stripe.Subscription {
    return {
      id: subscriptionId, customer: customerId, status, metadata: { tenantId },
      items: { object: 'list', has_more: false, data: [{
        id: itemId, object: 'subscription_item', subscription: subscriptionId, quantity: 1,
        current_period_start: now, current_period_end: end, price: price(),
      }] },
    } as unknown as Stripe.Subscription;
  }
  function invoice(label: string, amountPaid = 9000, end = now + 30 * 86400): Stripe.Invoice {
    return {
      id: `in_${token}${label}`, customer: customerId,
      parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId } },
      status: 'paid', amount_remaining: 0, amount_paid: amountPaid, currency: 'usd', created: now,
      status_transitions: { paid_at: now },
      lines: { has_more: false, data: [{
        id: `il_${token}${label}`, amount: amountPaid, currency: 'usd', quantity: 1,
        parent: { type: 'subscription_item_details', subscription_item_details: {
          subscription: subscriptionId, subscription_item: itemId, proration: false,
        } },
        pricing: { type: 'price_details', price_details: { price: priceId, product: productId } },
        period: { start: now, end },
      }] },
    } as unknown as Stripe.Invoice;
  }
  function event(type: string, object: unknown, created = now): Stripe.Event {
    const id = `evt_${token}${eventIds.length}`;
    eventIds.push(id);
    return { id, object: 'event', type, created, data: { object }, livemode: false,
      api_version: Stripe.API_VERSION, pending_webhooks: 1, request: null } as unknown as Stripe.Event;
  }
  async function signedDelivery(value: Stripe.Event): Promise<Response> {
    const body = JSON.stringify(value);
    const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret: process.env.STRIPE_WEBHOOK_SECRET! });
    return webhook(new Request('https://retained-price.example.test/api/billing/webhook', {
      method: 'POST', body, headers: { 'stripe-signature': signature },
    }), undefined);
  }
  async function local() { return getDb().subscription.findUniqueOrThrow({ where: { tenantId } }); }
  function trialSnapshot(value: Awaited<ReturnType<typeof local>>) {
    return { trialActivatedAt: value.trialActivatedAt, trialEndsAt: value.trialEndsAt, trialUsed: value.trialUsed, trialLimit: value.trialLimit };
  }
  beforeEach(async () => {
    token = randomUUID().replaceAll('-', '');
    now = Math.floor(Date.now() / 1000);
    eventIds.length = 0;
    tenantIds.length = 0;
    customerId = `cus_${token}`; subscriptionId = `sub_${token}`; itemId = `si_${token}`;
    priceId = `price_${token}retired`; currentPriceId = `price_${token}current`; productId = `prod_${token}`;
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_retained_price_transport_fixture');
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_retained_price_transport_fixture');
    vi.stubEnv('STRIPE_PRICE_ID', currentPriceId);
    vi.stubEnv('STRIPE_PRICE_HISTORY', JSON.stringify(history()));
    vi.stubEnv('PLATFORM_SUBSCRIPTION_CENTS', '');
    vi.stubEnv('PLATFORM_SUBSCRIPTION_CURRENCY', '');
    vi.stubEnv('APP_URL', 'https://retained-price.example.test');
    const db = getDb();
    const referrer = await db.tenant.create({ data: { name: 'Synthetic retained referrer', slug: `retained-${token}-a`, state: 'TX', medicalDirector: 'Synthetic fixture' } });
    tenantIds.push(referrer.id); referrerId = referrer.id;
    const tenant = await db.tenant.create({ data: { name: 'Synthetic retained clinic', slug: `retained-${token}-b`, state: 'TX', medicalDirector: 'Synthetic fixture' } });
    tenantIds.push(tenant.id); tenantId = tenant.id;
    await db.subscription.create({ data: { tenantId: referrerId, status: 'TRIAL' } });
    await db.subscription.create({ data: { tenantId, status: 'TRIAL', stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId,
      trialActivatedAt: new Date(now * 1000), trialEndsAt: new Date((now + 14 * 86400) * 1000), trialUsed: 3 } });
    const referral = await db.referral.create({ data: { referrerTenantId: referrerId, referredTenantId: tenantId, code: token,
      policyVersion: policy.version, policySnapshot: policy } });
    referralId = referral.id;
    providerSubscription = subscription();
    vi.spyOn(Stripe.resources.Subscriptions.prototype, 'retrieve').mockImplementation(async () => providerSubscription as Stripe.Response<Stripe.Subscription>);
  });
  afterEach(async () => {
    const db = getDb();
    await db.creditLedger.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await db.referral.deleteMany({ where: { referrerTenantId: { in: tenantIds } } });
    await db.billingEvent.deleteMany({ where: { eventId: { in: eventIds } } });
    await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => { await getDb().$disconnect(); });

  test('recognizes retained settlement after current offer rotation without resetting trial or referral history', async () => {
    const initialTrial = trialSnapshot(await local());
    const initialReferral = await getDb().referral.findUniqueOrThrow({ where: { id: referralId } });
    const balance = event('invoice.paid', invoice('balance', 0));
    expect((await signedDelivery(balance)).status).toBe(200);
    const settled = await local();
    expect(settled.status).toBe('ACTIVE');
    expect(settled.currentPeriodEnd!.getTime()).toBe((now + 30 * 86400) * 1000);
    expect(trialSnapshot(settled)).toEqual(initialTrial);
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
    expect((await getDb().referral.findUniqueOrThrow({ where: { id: referralId } })).convertedAt).toBeNull();
    const paid = invoice('paid');
    const first = event('invoice.paid', paid);
    await Promise.all([processBillingEvent(first), processBillingEvent(event('invoice.paid', paid))]);
    await processBillingEvent(first);
    const earned = await getDb().creditLedger.findMany({ where: { referralId } });
    expect(earned).toHaveLength(1);
    expect(earned[0]).toMatchObject({ kind: 'EARNED', amountCents: 2500, currency: 'USD', policyVersion: 3 });
    const converted = await getDb().referral.findUniqueOrThrow({ where: { id: referralId } });
    expect(converted).toMatchObject({ policyVersion: initialReferral.policyVersion, policySnapshot: initialReferral.policySnapshot,
      attributedAt: initialReferral.attributedAt, qualifyingInvoiceId: paid.id, status: 'CONVERTED' });
    const nextPeriod = now + 60 * 86400;
    providerSubscription = subscription('active', nextPeriod);
    await getDb().subscription.update({ where: { tenantId }, data: { status: 'PAST_DUE' } });
    expect((await signedDelivery(event('invoice.paid', invoice('discounted', 0, now + 90 * 86400)))).status).toBe(200);
    expect((await local()).currentPeriodEnd!.getTime()).toBe(nextPeriod * 1000);
    expect((await local()).status).toBe('ACTIVE');
    expect(trialSnapshot(await local())).toEqual(initialTrial);
    expect(await getDb().referral.findUniqueOrThrow({ where: { id: referralId } })).toEqual(converted);
    expect(await getDb().creditLedger.findMany({ where: { referralId } })).toEqual(earned);
  });

  test('keeps retained cancellation and past due status ordered after current offer rotation', async () => {
    const end = new Date((now + 30 * 86400) * 1000);
    await getDb().subscription.update({ where: { tenantId }, data: { status: 'ACTIVE', stripeStatus: 'ACTIVE', currentPeriodEnd: end } });
    const initialTrial = trialSnapshot(await local());
    await processBillingEvent(event('customer.subscription.updated', subscription('past_due'), now + 20));
    expect((await local()).status).toBe('PAST_DUE');
    await processBillingEvent(event('customer.subscription.deleted', subscription('canceled'), now + 40));
    expect((await local()).status).toBe('CANCELED');
    await processBillingEvent(event('customer.subscription.updated', subscription('past_due'), now + 10));
    await processBillingEvent(event('customer.subscription.updated', subscription('active', now + 90 * 86400), now + 30));
    expect(await local()).toMatchObject({ status: 'CANCELED', stripeStatus: 'CANCELED', currentPeriodEnd: end,
      lastStripeEventAt: new Date((now + 40) * 1000) });
    expect(trialSnapshot(await local())).toEqual(initialTrial);
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
  });

  test('rejects unauthorized retained contracts and ambiguous subscription items', async () => {
    const mutations: Array<(value: Stripe.Subscription) => void> = [
      value => { value.items.data[0].price.id = 'price_unconfigured'; },
      value => { value.items.data[0].price.product = 'prod_unrelated'; },
      value => { value.items.data[0].price.unit_amount = 0; value.items.data[0].price.unit_amount_decimal = Stripe.Decimal.zero; },
      value => { value.items.data[0].price.unit_amount = 9900; },
      value => { value.items.data[0].price.unit_amount_decimal = Stripe.Decimal.from('9000.5'); },
      value => { value.items.data[0].price.currency = 'cad'; },
      value => { value.items.data[0].price.type = 'one_time'; value.items.data[0].price.recurring = null; },
      value => { value.items.data[0].price.recurring!.interval = 'year'; },
      value => { value.items.data[0].price.recurring!.interval_count = 3; },
      value => { value.items.data[0].price.recurring!.usage_type = 'metered'; },
      value => { value.items.data[0].price.billing_scheme = 'tiered'; },
      value => { value.items.data[0].price.custom_unit_amount = { minimum: null, maximum: null, preset: 9000 }; },
      value => { value.items.data[0].price.transform_quantity = { divide_by: 2, round: 'up' }; },
      value => { value.items.data[0].quantity = 2; },
      value => { value.items.has_more = true; },
      value => { value.items.data.push({ ...value.items.data[0], id: `si_${token}second`, price: price(currentPriceId, 19900, true) }); },
      value => { value.items.data.push({ ...value.items.data[0], id: `si_${token}duplicate` }); },
    ];
    for (let i = 0; i < mutations.length; i++) {
      providerSubscription = subscription();
      mutations[i](providerSubscription);
      expect((await signedDelivery(event('invoice.paid', invoice(`shape${i}`)))).status).toBe(200);
      expect((await local()).status).toBe('TRIAL');
    }
    vi.stubEnv('STRIPE_PRICE_HISTORY', '');
    providerSubscription = subscription();
    expect((await signedDelivery(event('invoice.paid', invoice('unconfigured')))).status).toBe(200);
    expect((await local()).status).toBe('TRIAL');
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
  });

  test('keeps retained invoice customer tenant subscription line product currency and period guards', async () => {
    const mutations: Array<(value: Stripe.Invoice) => void> = [
      value => { value.customer = 'cus_unrelated'; },
      value => { value.parent!.subscription_details!.subscription = 'sub_unrelated'; },
      value => { value.currency = 'cad'; },
      value => { value.status = 'open'; },
      value => { value.amount_remaining = 1; },
      value => { value.lines.data[0].parent!.subscription_item_details!.subscription = 'sub_unrelated'; },
      value => { value.lines.data[0].parent!.subscription_item_details!.subscription_item = 'si_unrelated'; },
      value => { value.lines.data[0].pricing!.price_details!.price = 'price_unrelated'; },
      value => { value.lines.data[0].pricing!.price_details!.product = 'prod_unrelated'; },
      value => { value.lines.data[0].currency = 'cad'; },
      value => { value.lines.data[0].quantity = 0; },
      value => { value.lines.data[0].amount = -1; },
      value => { value.lines.data[0].period.end = 0; },
    ];
    for (let i = 0; i < mutations.length; i++) {
      const value = invoice(`line${i}`);
      mutations[i](value);
      expect((await signedDelivery(event('invoice.paid', value))).status).toBe(200);
      expect((await local()).status).toBe('TRIAL');
    }
    providerSubscription = subscription('trialing');
    expect((await signedDelivery(event('invoice.paid', invoice('trialing')))).status).toBe(200);
    providerSubscription = subscription(); providerSubscription.metadata.tenantId = referrerId;
    expect((await signedDelivery(event('invoice.paid', invoice('wrongtenant')))).status).toBe(200);
    providerSubscription = subscription(); providerSubscription.customer = 'cus_unrelated';
    expect((await signedDelivery(event('invoice.paid', invoice('wrongretrievedcustomer')))).status).toBe(500);
    expect((await local()).status).toBe('TRIAL');
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
  });

  test('fails invalid retained configuration without consuming retryable billing events', async () => {
    const invalid = ['{', '{}', JSON.stringify([...history(), ...history()]),
      JSON.stringify([{ ...history()[0], priceId: currentPriceId }]), JSON.stringify([{ ...history()[0], extra: true }])];
    for (let i = 0; i < invalid.length; i++) {
      vi.stubEnv('STRIPE_PRICE_HISTORY', invalid[i]);
      const value = event('invoice.paid', invoice(`config${i}`, 0));
      const failed = await signedDelivery(value);
      expect(failed.status).toBe(503);
      expect(await failed.json()).toMatchObject({ code: 'BILLING_PRICE_HISTORY_INVALID' });
      expect(await getDb().billingEvent.findUniqueOrThrow({ where: { eventId: value.id } })).toMatchObject({ status: 'FAILED', processedAt: null });
      expect((await local()).status).toBe(i === 0 ? 'TRIAL' : 'ACTIVE');
      vi.stubEnv('STRIPE_PRICE_HISTORY', JSON.stringify(history()));
      expect((await signedDelivery(value)).status).toBe(200);
      expect(await getDb().billingEvent.findUniqueOrThrow({ where: { eventId: value.id } })).toMatchObject({ status: 'PROCESSED', errorCode: null });
    }
    expect(await getDb().creditLedger.count({ where: { referralId } })).toBe(0);
  });

  test('checkout still selects only the current verified offer when retired contracts exist', async () => {
    const current = price(currentPriceId, 19900, true);
    current.product = { id: productId, object: 'product', active: true } as Stripe.Product;
    const retrieve = vi.spyOn(Stripe.resources.Prices.prototype, 'retrieve').mockResolvedValue(current as Stripe.Response<Stripe.Price>);
    vi.spyOn(Stripe.resources.Customers.prototype, 'create').mockResolvedValue({ id: `cus_${token}checkout` } as Stripe.Response<Stripe.Customer>);
    vi.spyOn(Stripe.resources.Subscriptions.prototype, 'list').mockImplementation(() => stream([]) as unknown as Stripe.ApiListPromise<Stripe.Subscription>);
    const sessions = Object.getPrototypeOf(stripe.checkout.sessions) as typeof stripe.checkout.sessions;
    vi.spyOn(sessions, 'list').mockImplementation(() => stream([]) as unknown as Stripe.ApiListPromise<Stripe.Checkout.Session>);
    const create = vi.spyOn(sessions, 'create').mockResolvedValue({ id: `cs_${token}`, url: 'https://checkout.stripe.com/transport-fixture' } as Stripe.Response<Stripe.Checkout.Session>);
    expect(await checkout(referrerId, 'synthetic-owner@example.test')).toEqual({ url: 'https://checkout.stripe.com/transport-fixture' });
    expect(retrieve).toHaveBeenCalledWith(currentPriceId, { expand: ['product'] });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({ line_items: [{ price: currentPriceId, quantity: 1 }], metadata: { priceId: currentPriceId } });
    expect((await local()).stripeSubscriptionId).toBe(subscriptionId);
    expect((await local()).status).toBe('TRIAL');
  });
});
