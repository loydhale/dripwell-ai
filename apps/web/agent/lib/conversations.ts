import { getDb } from '../../lib/db';

export async function appendSetupMessage(
  id: string,
  tenantId: string,
  message: { id: string; role: 'user' | 'assistant'; text: string; createdAt: string },
) {
  const array = JSON.stringify([message]);
  const marker = JSON.stringify([{ id: message.id }]);
  await getDb()
    .$executeRaw`UPDATE "SetupConversation" SET "messages" = "messages" || ${array}::jsonb,
    "updatedAt" = NOW() WHERE "id" = ${id}::uuid AND "tenantId" = ${tenantId}::uuid AND NOT "messages" @> ${marker}::jsonb`;
}
