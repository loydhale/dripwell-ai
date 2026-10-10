import { stripeClient, processBillingEvent } from '@/lib/billing';
import { ApiError } from '@/lib/errors';
import { getDb } from '@/lib/db';
import { apiRoute, json } from '@/lib/http';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = apiRoute(async (request) => {
  const signingSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signingSecret)
    throw new ApiError(503, 'Billing webhooks have not been configured.', 'BILLING_UNAVAILABLE');
  const signature = request.headers.get('stripe-signature');
  if (!signature) throw new ApiError(400, 'Invalid billing signature.', 'INVALID_SIGNATURE');
  if (Number(request.headers.get('content-length') ?? 0) > 2000000)
    throw new ApiError(413, 'Billing event is too large.');
  const body = await request.text();
  if (Buffer.byteLength(body, 'utf8') > 2000000)
    throw new ApiError(413, 'Billing event is too large.');
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(body, signature, signingSecret);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Invalid billing signature.', 'INVALID_SIGNATURE');
  }
  try {
    await processBillingEvent(event);
  } catch (error) {
    await getDb().billingEvent.updateMany({
      where: { eventId: event.id },
      data: {
        status: 'FAILED',
        errorCode: error instanceof ApiError ? error.code : 'BILLING_PROCESSING_FAILED',
      },
    });
    throw error;
  }
  return json({ received: true });
});
