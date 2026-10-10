import { eveChannel } from 'eve/channels/eve';
import { ForbiddenError, type AuthFn } from 'eve/channels/auth';
import { getActorFromRequest } from '../../lib/auth';
import { assertOrigin } from '../../lib/http';
import { getDb } from '../../lib/db';
import { rateLimit } from '../../lib/rate-limit';
import { verifiedOwner } from '../lib/scope';
import { appendSetupMessage } from '../lib/conversations';
import { z } from 'zod';

const ownerSession: AuthFn<Request> = async (request) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      assertOrigin(request);
    } catch {
      throw new ForbiddenError({ message: 'Open this action from DripWell.' });
    }
  }
  const actor = await getActorFromRequest(request);
  if (!actor || actor.role !== 'SUPER_USER' || !actor.tenantId) return null;
  let selectedLocationId: string | null = null;
  // eve route auth intentionally does not provide a session ownership ACL.
  // Guard every continuation/control/stream path using our durable binding.
  const sessionPath = new URL(request.url).pathname.match(/\/eve\/v1\/session\/([^/]+)/);
  if (sessionPath) {
    const sessionId = decodeURIComponent(sessionPath[1]!);
    const binding = await getDb().setupConversation.findFirst({
      where: {
        eveSessionId: sessionId,
        tenantId: actor.tenantId,
        userId: actor.userId,
        locationId: { not: null },
        location: { is: { tenantId: actor.tenantId, isActive: true } },
      },
      select: { id: true, locationId: true },
    });
    if (!binding)
      throw new ForbiddenError({
        message: 'This setup conversation is not available to your account.',
      });
    selectedLocationId = binding.locationId;
  } else if (
    request.method === 'POST' &&
    new URL(request.url).pathname.endsWith('/eve/v1/session')
  ) {
    const text = await request.clone().text();
    if (text.trim())
      throw new ForbiddenError({ message: 'Start setup through the DripWell setup assistant.' });
    const requested = z
      .string()
      .uuid()
      .safeParse(request.headers.get('x-dripwell-setup-conversation-id'));
    const binding = requested.success
      ? await getDb().setupConversation.findFirst({
          where: {
            id: requested.data,
            tenantId: actor.tenantId,
            userId: actor.userId,
            eveSessionId: null,
            locationId: { not: null },
            location: { is: { tenantId: actor.tenantId, isActive: true } },
          },
          select: { locationId: true },
        })
      : null;
    if (!binding?.locationId)
      throw new ForbiddenError({
        message: 'Start a location-bound conversation through the DripWell setup assistant.',
      });
    selectedLocationId = binding.locationId;
    await rateLimit(`eve-session:${actor.tenantId}:${actor.userId}`, {
      limit: 30,
      windowMs: 3600000,
    });
  }
  return {
    principalId: `${actor.tenantId}/${actor.userId}`,
    principalType: 'user',
    authenticator: 'dripwell-session',
    attributes: {
      tenantId: actor.tenantId,
      userId: actor.userId,
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
      role: actor.role,
    },
  };
};

export default eveChannel({
  auth: [ownerSession],
  audience: 'private',
  turnPolicy: 'queue',
  events: {
    async 'message.completed'(event, _channel, ctx) {
      const { tenantId, userId, locationId } = await verifiedOwner(ctx);
      const conversation = await getDb().setupConversation.findFirst({
        where: { tenantId, userId, locationId, eveSessionId: ctx.session.id },
        select: { id: true },
      });
      if (!conversation) throw new Error('SETUP_CONVERSATION_NOT_BOUND');
      await appendSetupMessage(conversation.id, tenantId, {
        id: `${ctx.session.id}:${event.turnId}:${event.stepIndex}:assistant`,
        role: 'assistant',
        text: event.message,
        createdAt: new Date().toISOString(),
      });
    },
  },
});
