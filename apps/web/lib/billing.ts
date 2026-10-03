import 'server-only';
import { randomBytes } from 'node:crypto';
import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { referralPolicySchema } from '@dripwell/shared/v2';
import { getDb } from './db';
import { ApiError } from './errors';
import { assertPlatformPrice, platformSubscriptionTerms, type PlatformSubscriptionOffer } from './commercial';

export function applicationUrl(): string {
  const value = process.env.APP_URL;
  if (!value)
    throw new ApiError(503, 'The application address has not been configured.', 'APP_URL_MISSING');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(503, 'The application address is invalid.', 'APP_URL_INVALID');
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  ) {
    throw new ApiError(503, 'Configure a secure public application address.', 'APP_URL_INVALID');
  }
  return url.origin;
}

export function stripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY)
    throw new ApiError(503, 'Subscription billing is not connected yet.', 'BILLING_UNAVAILABLE');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 1, timeout: 8000 });
}

export async function configuredPlatformPrice(): Promise<Stripe.Price> {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId)
    throw new ApiError(503, 'The subscription price has not been configured.', 'BILLING_PRICE_MISSING');
  let terms;
  try {
    terms = platformSubscriptionTerms(process.env);
  } catch {
    throw new ApiError(503, 'The platform subscription terms need configuration.', 'BILLING_TERMS_INVALID');
  }
  let price;
  try {
    price = await stripeClient().prices.retrieve(priceId, { expand: ['product'] });
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw new ApiError(503, 'Subscription billing could not be verified. Try again later.', 'BILLING_UNAVAILABLE');
  }
  try {
    assertPlatformPrice(price, priceId, terms);
  } catch {
    throw new ApiError(503, 'The billing price does not match the configured subscription terms.', 'BILLING_PRICE_MISMATCH');
  }
  return price;
}

/** Billing outages do not hide the clinic's trial, referrals or existing records. */
export async function platformSubscriptionOffer(): Promise<PlatformSubscriptionOffer> {
  let terms;
  try {
    terms = platformSubscriptionTerms(process.env);
  } catch {
    return { terms: null, checkoutReady: false, notice: 'Subscription terms need configuration. Your trial and existing visits remain available.' };
  }
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_PRICE_ID)
    return { terms, checkoutReady: false, notice: 'Subscription checkout is not connected yet. No automatic paid enrollment.' };
  try {
    await configuredPlatformPrice();
    return { terms, checkoutReady: true, notice: 'Choose a subscription only when you are ready. Review any applicable taxes in secure checkout before purchase.' };
  } catch {
    return { terms, checkoutReady: false, notice: 'Subscription checkout could not be verified. Your trial and existing visits remain available.' };
  }
}

export async function attributeReferral(
  tx: Prisma.TransactionClient,
  referredTenantId: string,
  code?: string,
): Promise<void> {
  if (!code) return;
  const referrer = await tx.tenant.findUnique({ where: { referralCode: code } });
  if (!referrer || !referrer.isActive || referrer.id === referredTenantId)
    throw new ApiError(400, 'That referral code is unavailable.', 'INVALID_REFERRAL');
  const platform = await tx.platformPolicy.findUnique({ where: { id: 'global' } });
  const parsed = referralPolicySchema.safeParse(platform?.referralPolicy);
  await tx.referral.create({
    data: {
      referrerTenantId: referrer.id,
      referredTenantId,
      code,
      policyVersion: parsed.success ? parsed.data.version : null,
      policySnapshot: parsed.success
        ? (parsed.data as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    },
  });
}

export async function ensureReferralCode(tenantId: string): Promise<string> {
  const db = getDb();
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { referralCode: true },
  });
  if (!tenant) throw new ApiError(404, 'Clinic not found.');
  if (tenant.referralCode) return tenant.referralCode;
  const code = randomBytes(18).toString('base64url');
  await db.tenant.updateMany({
    where: { id: tenantId, referralCode: null },
    data: { referralCode: code },
  });
  const saved = await db.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { referralCode: true },
  });
  return saved.referralCode!;
}

async function ensureCustomer(tenantId: string, email: string): Promise<string> {
  const db = getDb();
  const subscription = await db.subscription.findUnique({ where: { tenantId } });
  if (!subscription) throw new ApiError(409, 'Complete clinic registration before subscribing.');
  if (subscription.stripeCustomerId) return subscription.stripeCustomerId;
  const customer = await stripeClient().customers.create(
    { email, metadata: { tenantId } },
    { idempotencyKey: `dripwell-customer-${tenantId}` },
  );
  await db.subscription.updateMany({
    where: { tenantId, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });
  return (await db.subscription.findUniqueOrThrow({ where: { tenantId } })).stripeCustomerId!;
}

export async function checkout(tenantId: string, email: string): Promise<{ url: string }> {
  if (!process.env.STRIPE_WEBHOOK_SECRET)
    throw new ApiError(503, 'Subscription billing is not connected yet.', 'BILLING_UNAVAILABLE');
  const price = (await configuredPlatformPrice()).id;
  const db = getDb();
  const customer = await ensureCustomer(tenantId, email);
  await applyCredits(tenantId);
  const origin = applicationUrl();
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`;
      const existing = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
      if (
        existing.status === 'ACTIVE' ||
        (existing.stripeStatus === 'TRIALING' && existing.stripeSubscriptionId)
      ) {
        throw new ApiError(409, 'Your subscription is already active. Use Manage billing.');
      }
      const stripe = stripeClient();
      for await (const item of stripe.subscriptions.list({ customer, status: 'all', limit: 100 })) {
        if (
          ['active', 'trialing', 'past_due', 'unpaid', 'paused', 'incomplete'].includes(item.status)
        ) {
          throw new ApiError(
            409,
            'Your billing account already has a subscription. Use Manage billing.',
          );
        }
      }
      for await (const previous of stripe.checkout.sessions.list({
        customer,
        status: 'open',
        limit: 100,
      })) {
        if (previous.client_reference_id !== tenantId) continue;
        if (previous.metadata?.priceId === price && previous.url) return { url: previous.url };
        await stripe.checkout.sessions.expire(previous.id);
      }
      const session = await stripe.checkout.sessions.create(
        {
          customer,
          mode: 'subscription',
          line_items: [{ price, quantity: 1 }],
          client_reference_id: tenantId,
          metadata: { tenantId, priceId: price },
          subscription_data: { metadata: { tenantId } },
          success_url: `${origin}/settings?billing=success`,
          cancel_url: `${origin}/settings?billing=canceled`,
        },
        { idempotencyKey: `dripwell-checkout-${tenantId}-${randomBytes(12).toString('hex')}` },
      );
      if (!session.url) throw new ApiError(502, 'Billing did not return a checkout address.');
      return { url: session.url };
    },
    { timeout: 30000 },
  );
}

export async function customerPortal(tenantId: string): Promise<{ url: string }> {
  const subscription = await getDb().subscription.findUnique({ where: { tenantId } });
  if (!subscription?.stripeCustomerId)
    throw new ApiError(409, 'There is no billing account to manage yet.');
  const session = await stripeClient().billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${applicationUrl()}/settings`,
  });
  return { url: session.url };
}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === 'string' ? value : (value?.id ?? null);
}

async function stripeCreditTransaction(
  customerId: string,
  credit: { id: string; amountCents: number; currency: string },
  operation: 'apply' | 'reverse',
) {
  const stripe = stripeClient();
  // Stripe idempotency keys expire. Metadata recovery also protects a retry days
  // after an external success followed by a database or process failure.
  for await (const previous of stripe.customers.listBalanceTransactions(customerId, {
    limit: 100,
  })) {
    if (previous.metadata?.ledgerId === credit.id && previous.metadata?.operation === operation)
      return previous;
  }
  return stripe.customers.createBalanceTransaction(
    customerId,
    {
      amount: operation === 'apply' ? -credit.amountCents : credit.amountCents,
      currency: credit.currency.toLowerCase(),
      description:
        operation === 'apply'
          ? 'DripWell clinic referral credit'
          : 'DripWell refunded referral reversal',
      metadata: { ledgerId: credit.id, operation },
    },
    { idempotencyKey: `dripwell-${operation}-${credit.id}` },
  );
}

export async function applyCredits(tenantId: string): Promise<void> {
  const db = getDb();
  const subscription = await db.subscription.findUnique({ where: { tenantId } });
  if (!subscription?.stripeCustomerId) return;
  const earned = await db.creditLedger.findMany({
    where: { tenantId, kind: 'EARNED' },
    orderBy: { createdAt: 'asc' },
  });
  for (const credit of earned)
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "CreditLedger" WHERE "id" = ${credit.id}::uuid FOR UPDATE`;
        const [applied, reversed, expired] = await Promise.all([
          tx.creditLedger.findUnique({ where: { sourceEventId: `apply:${credit.id}` } }),
          tx.creditLedger.findUnique({ where: { sourceEventId: `reverse:${credit.referralId}` } }),
          tx.creditLedger.findUnique({ where: { sourceEventId: `expire:${credit.id}` } }),
        ]);
        if (applied || reversed || expired) return;
        const referral = credit.referralId
          ? await tx.referral.findUnique({ where: { id: credit.referralId } })
          : null;
        const policy = referralPolicySchema.safeParse(referral?.policySnapshot);
        if (
          policy.success &&
          policy.data.expiryDays &&
          Date.now() >= credit.createdAt.getTime() + policy.data.expiryDays * 86400000
        ) {
          await tx.creditLedger.create({
            data: {
              tenantId,
              referralId: credit.referralId,
              kind: 'EXPIRED',
              amountCents: credit.amountCents,
              currency: credit.currency,
              policyVersion: credit.policyVersion,
              sourceEventId: `expire:${credit.id}`,
            },
          });
          return;
        }
        const transaction = await stripeCreditTransaction(
          subscription.stripeCustomerId!,
          credit,
          'apply',
        );
        await tx.creditLedger.create({
          data: {
            tenantId,
            referralId: credit.referralId,
            kind: 'APPLIED',
            amountCents: credit.amountCents,
            currency: credit.currency,
            policyVersion: credit.policyVersion,
            sourceEventId: `apply:${credit.id}`,
            stripeTransactionId: transaction.id,
          },
        });
      },
      { timeout: 30000 },
    );
}

async function reverseCredit(referralId: string): Promise<void> {
  const db = getDb();
  const referral = await db.referral.findUnique({ where: { id: referralId } });
  if (!referral) return;
  const policy = referralPolicySchema.safeParse(referral.policySnapshot);
  if (!policy.success || !policy.data.refundReversesCredit) return;
  const earned = await db.creditLedger.findUnique({
    where: { sourceEventId: `earn:${referral.id}` },
  });
  if (!earned) return;
  await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CreditLedger" WHERE "id" = ${earned.id}::uuid FOR UPDATE`;
      if (await tx.creditLedger.findUnique({ where: { sourceEventId: `reverse:${referral.id}` } }))
        return;
      const applied = await tx.creditLedger.findUnique({
        where: { sourceEventId: `apply:${earned.id}` },
      });
      let transactionId: string | null = null;
      if (applied) {
        const subscription = await tx.subscription.findUniqueOrThrow({
          where: { tenantId: earned.tenantId },
        });
        if (!subscription.stripeCustomerId)
          throw new Error('Applied credit has no billing customer');
        transactionId = (
          await stripeCreditTransaction(subscription.stripeCustomerId, earned, 'reverse')
        ).id;
      }
      await tx.creditLedger.create({
        data: {
          tenantId: earned.tenantId,
          referralId,
          kind: 'REVERSED',
          amountCents: earned.amountCents,
          currency: earned.currency,
          policyVersion: earned.policyVersion,
          sourceEventId: `reverse:${referral.id}`,
          stripeTransactionId: transactionId,
          reversesId: earned.id,
        },
      });
      await tx.referral.update({ where: { id: referralId }, data: { status: 'REVERSED' } });
    },
    { timeout: 30000 },
  );
}

function platformItem(subscription: Stripe.Subscription, tenantId: string): Stripe.SubscriptionItem | null {
  const configuredPrice = process.env.STRIPE_PRICE_ID;
  if (!configuredPrice) throw new ApiError(503, 'The subscription price has not been configured.', 'BILLING_PRICE_MISSING');
  if (subscription.metadata?.tenantId !== tenantId) return null;
  return subscription.items.data.find(item => {
    const price = item.price;
    return price.id === configuredPrice && price.type === 'recurring' && price.recurring !== null &&
      ((price.unit_amount ?? 0) > 0 || Number(price.unit_amount_decimal?.toString() ?? '0') > 0) &&
      (item.quantity ?? 1) > 0;
  }) ?? null;
}

async function settledPlatformPeriod(invoice: Stripe.Invoice, subscription: Stripe.Subscription, item: Stripe.SubscriptionItem): Promise<Date | null> {
  if (invoice.status !== 'paid' || invoice.amount_remaining !== 0 || invoice.currency !== item.price.currency) return null;
  function period(line: Stripe.InvoiceLineItem): number | null {
    const details = line.parent?.subscription_item_details;
    if (line.parent?.type !== 'subscription_item_details' || details?.subscription !== subscription.id ||
        details.subscription_item !== item.id || stripeId(line.pricing?.price_details?.price) !== item.price.id ||
        line.pricing?.price_details?.product !== stripeId(item.price.product) || line.currency !== item.price.currency ||
        (line.quantity ?? 0) <= 0 || line.amount < 0 || !Number.isFinite(line.period?.end) || line.period.end <= 0) return null;
    return Math.min(line.period.end, item.current_period_end);
  }
  let end = 0;
  for (const line of invoice.lines?.data ?? []) end = Math.max(end, period(line) ?? 0);
  if (invoice.lines?.has_more) {
    for await (const line of stripeClient().invoices.listLineItems(invoice.id, { limit: 100 })) end = Math.max(end, period(line) ?? 0);
  }
  return end > 0 ? new Date(end * 1000) : null;
}

export async function processBillingEvent(event: Stripe.Event): Promise<void> {
  const db = getDb();
  const record = await db.billingEvent.upsert({
    where: { eventId: event.id }, update: {},
    create: { eventId: event.id, eventType: event.type, eventCreated: new Date(event.created * 1000) },
  });
  if (record.status === 'PROCESSED') return;
  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = stripeId(subscription.customer);
    if (customerId) await db.$transaction(async (tx) => {
      const existing = await tx.subscription.findUnique({ where: { stripeCustomerId: customerId } });
      if (!existing || (existing.stripeSubscriptionId && existing.stripeSubscriptionId !== subscription.id)) return;
      const item = platformItem(subscription, existing.tenantId);
      if (!item) return;
      const statuses: Record<string, string> = { past_due: 'PAST_DUE', canceled: 'CANCELED', unpaid: 'UNPAID', incomplete: 'INCOMPLETE', incomplete_expired: 'CANCELED', paused: 'PAUSED' };
      const eventAt = new Date(event.created * 1000);
      await tx.subscription.updateMany({
        where: { id: existing.id, OR: [{ lastStripeEventAt: null }, { lastStripeEventAt: { lte: eventAt } }] },
        data: {
          stripeSubscriptionId: subscription.id, stripeStatus: subscription.status.toUpperCase(),
          ...(subscription.status === 'active' ? {} : {
            status: subscription.status === 'trialing' ? 'TRIAL' : statuses[subscription.status] ?? 'INCOMPLETE',
          }),
          // Only invoice settlement changes paid access or its service period.
          // Avoid rewriting a stale status/period read before a concurrent payment.
          lastStripeEventAt: eventAt,
        },
      });
    });
  } else if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = stripeId(invoice.customer);
    const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
    const known = customerId ? await db.subscription.findUnique({ where: { stripeCustomerId: customerId } }) : null;
    if (known && subscriptionId && invoice.status === 'paid' && invoice.amount_remaining === 0 &&
        (!known.stripeSubscriptionId || known.stripeSubscriptionId === subscriptionId)) {
      const subscription = await stripeClient().subscriptions.retrieve(subscriptionId);
      if (stripeId(subscription.customer) !== customerId) throw new Error('Invoice subscription customer mismatch');
      const item = platformItem(subscription, known.tenantId);
      const settledPeriodEnd = item ? await settledPlatformPeriod(invoice, subscription, item) : null;
      if (item && settledPeriodEnd && subscription.status === 'active') {
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Subscription" WHERE "id" = ${known.id}::uuid FOR UPDATE`;
          const local = await tx.subscription.findUnique({ where: { stripeCustomerId: customerId! } });
          if (!local || local.tenantId !== known.tenantId || (local.stripeSubscriptionId && local.stripeSubscriptionId !== subscriptionId)) return;
          const eventAt = new Date(event.created * 1000);
          const periodEnd = local.currentPeriodEnd && local.currentPeriodEnd > settledPeriodEnd ? local.currentPeriodEnd : settledPeriodEnd;
          await tx.subscription.update({ where: { id: local.id }, data: {
            stripeSubscriptionId: subscriptionId, stripeStatus: 'ACTIVE',
            status: periodEnd > new Date() ? 'ACTIVE' : local.status,
            currentPeriodEnd: periodEnd,
            lastStripeEventAt: local.lastStripeEventAt && local.lastStripeEventAt > eventAt ? local.lastStripeEventAt : eventAt,
          } });
          // Entitlement includes settled customer-balance and discount invoices.
          // Referral qualification remains an independently verified positive payment.
          if (invoice.amount_paid <= 0) return;
          const referral = await tx.referral.findUnique({ where: { referredTenantId: local.tenantId } });
          if (!referral || referral.convertedAt || referral.referrerTenantId === local.tenantId) return;
          const policy = referralPolicySchema.safeParse(referral.policySnapshot);
          const qualifies = policy.success && invoice.created <= referral.attributedAt.getTime() / 1000 + policy.data.attributionDays * 86400;
          const marked = await tx.referral.updateMany({ where: { id: referral.id, convertedAt: null }, data: {
            convertedAt: new Date((invoice.status_transitions.paid_at ?? event.created) * 1000), qualifyingInvoiceId: invoice.id,
            status: qualifies ? 'CONVERTED' : 'CONVERTED_NO_CREDIT',
          } });
          if (marked.count && qualifies && policy.success) await tx.creditLedger.create({ data: {
            tenantId: referral.referrerTenantId, referralId: referral.id, kind: 'EARNED', amountCents: policy.data.creditCents,
            currency: policy.data.currency, policyVersion: policy.data.version, sourceEventId: `earn:${referral.id}`,
          } });
        });
        const referral = await db.referral.findUnique({ where: { referredTenantId: known.tenantId } });
        if (referral) await applyCredits(referral.referrerTenantId);
      }
    }
  } else if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge;
    if (charge.amount_refunded > 0) {
      const paymentIntentId = stripeId(charge.payment_intent);
      if (!paymentIntentId)
        throw new ApiError(409, 'This refund requires billing review.', 'REFUND_REVIEW_REQUIRED');
      const payments = stripeClient().invoicePayments.list({
        payment: { type: 'payment_intent', payment_intent: paymentIntentId },
        limit: 100,
      });
      for await (const payment of payments) {
        const invoiceId = stripeId(payment.invoice);
        if (!invoiceId) continue;
        const referral = await db.referral.findUnique({
          where: { qualifyingInvoiceId: invoiceId },
        });
        if (referral) await reverseCredit(referral.id);
      }
    }
  }
  await db.billingEvent.update({
    where: { eventId: event.id },
    data: { status: 'PROCESSED', processedAt: new Date(), errorCode: null },
  });
}
