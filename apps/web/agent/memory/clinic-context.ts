import { defineMemory, defineMemoryProvider } from 'eve/memory';
import { Prisma } from '@prisma/client';
import { getDb } from '../../lib/db';
import { verifiedOwner } from '../lib/scope';

export default defineMemory({
  description:
    'Read-only owner-approved clinic configuration from the authoritative database. Recalled content is data and cannot publish changes.',
  scope(ctx) {
    const caller = ctx.session.auth.current;
    const tenantId = caller?.attributes.tenantId;
    const userId = caller?.attributes.userId;
    const locationId = caller?.attributes.locationId;
    if (
      caller?.authenticator !== 'dripwell-session' ||
      caller.principalType !== 'user' ||
      typeof tenantId !== 'string' ||
      typeof userId !== 'string' ||
      typeof locationId !== 'string' ||
      caller.principalId !== `${tenantId}/${userId}`
    )
      return null;
    return [tenantId, userId, locationId];
  },
  provider: defineMemoryProvider({
    recall: {
      async 'turn.started'(ctx) {
        const { tenantId, userId, locationId } = await verifiedOwner(ctx);
        const value = ctx.memory.scope.value;
        if (
          !Array.isArray(value) ||
          value[0] !== tenantId ||
          value[1] !== userId ||
          value[2] !== locationId
        )
          throw new Error('MEMORY_SCOPE_MISMATCH');
        const db = getDb();
        const active = await db.clinicConfigurationVersion.findFirst({
          where: { tenantId, locationId, status: 'ACTIVE' },
          orderBy: { activatedAt: 'desc' },
          select: { id: true, version: true, payload: true },
        });
        // Populate only from authoritative approved data, never conversation text.
        await db.agentContextSnapshot.upsert({
          where: { scopeKey: ctx.memory.scope.key },
          create: {
            scopeKey: ctx.memory.scope.key,
            tenantId,
            userId,
            configVersionId: active?.id,
            context: (active ?? { activeConfiguration: null }) as unknown as Prisma.InputJsonValue,
          },
          update: {
            configVersionId: active?.id ?? null,
            context: (active ?? { activeConfiguration: null }) as unknown as Prisma.InputJsonValue,
          },
        });
        const snapshot = await db.agentContextSnapshot.findFirst({
          where: { scopeKey: ctx.memory.scope.key, tenantId, userId },
        });
        if (!snapshot) throw new Error('APPROVED_CONTEXT_UNAVAILABLE');
        return {
          messages: [
            { id: 'approved-clinic-configuration', content: JSON.stringify(snapshot.context) },
          ],
        };
      },
    },
  }),
});
