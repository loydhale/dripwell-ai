import { randomUUID, createHash } from 'node:crypto';
import { Client } from 'eve/client';
import { z } from 'zod';
import { requireOwner } from '../../../lib/auth';
import { getDb } from '../../../lib/db';
import { ApiError } from '../../../lib/errors';
import { apiRoute, json, readJson } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import {
  AI_MODEL,
  assertAIReady,
  AIUnavailableError,
  aiReadiness,
  SETUP_PROMPT_VERSION,
  safeAIError,
  estimateTextCost,
} from '../../../lib/ai';
import { jsonValue, parseRecordingInput, validateSetupLocation } from '../../../lib/recordings';
import { setupProposalSchema } from '../../../agent/tools/propose_draft';
import { appendSetupMessage } from '../../../agent/lib/conversations';

export const maxDuration = 300;
const messageSchema = z.object({
  message: z.string().trim().min(1).max(30000),
  locationId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  idempotencyKey: z.string().min(16).max(200).optional(),
});

export const GET = apiRoute(async (request) => {
  const actor = await requireOwner();
  const locationId = await validateSetupLocation(
    actor,
    parseRecordingInput(z.string().uuid(), new URL(request.url).searchParams.get('locationId')),
  );
  const id = new URL(request.url).searchParams.get('conversationId');
  const conversation = id
    ? await getDb().setupConversation.findFirst({
        where: {
          id: parseRecordingInput(z.string().uuid(), id),
          tenantId: actor.tenantId,
          userId: actor.userId,
          locationId,
        },
      })
    : await getDb().setupConversation.findFirst({
        where: { tenantId: actor.tenantId, userId: actor.userId, locationId },
        orderBy: { updatedAt: 'desc' },
      });
  if (id && !conversation) throw new ApiError(404, 'Setup conversation not found.', 'NOT_FOUND');
  return json({ conversation, readiness: aiReadiness() });
});

export const POST = apiRoute(
  async (request) => {
    const actor = await requireOwner();
    const input = await readJson(request, messageSchema);
    const locationId = await validateSetupLocation(actor, input.locationId);
    await rateLimit(`setup-chat:${actor.tenantId}:${actor.userId}`, {
      limit: 30,
      windowMs: 3600000,
    });
    try {
      assertAIReady();
    } catch (error) {
      if (error instanceof AIUnavailableError) throw new ApiError(503, error.message, error.code);
      throw error;
    }
    const db = getDb();
    const key = `setup-message:${input.idempotencyKey ?? randomUUID()}`;
    const messageHash = createHash('sha256').update(input.message).digest('hex');
    const lockKey = `${actor.tenantId}:${createHash('sha256').update(key).digest('hex')}`;
    const prepared = await db.$transaction(async (tx) => {
      // Serialize creation and failed-job claims. Model work stays outside this transaction.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const existing = await tx.generationJob.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId: actor.tenantId, idempotencyKey: key },
        },
      });
      if (existing) {
        const payload =
          existing.result && typeof existing.result === 'object' && !Array.isArray(existing.result)
            ? existing.result
            : {};
        const conversation =
          typeof payload.conversationId === 'string'
            ? await tx.setupConversation.findFirst({
                where: {
                  id: payload.conversationId,
                  tenantId: actor.tenantId,
                  userId: actor.userId,
                  locationId,
                },
              })
            : null;
        if (
          existing.kind !== 'SETUP_CHAT' ||
          existing.userId !== actor.userId ||
          !conversation ||
          payload.messageHash !== messageHash ||
          (input.conversationId && input.conversationId !== conversation.id)
        )
          throw new ApiError(
            409,
            'This request key belongs to another operation.',
            'IDEMPOTENCY_CONFLICT',
          );
        if (existing.status !== 'FAILED') return { existing, conversation, job: null };
        const job = await tx.generationJob.update({
          where: { id: existing.id },
          data: { status: 'RUNNING', errorCode: null, startedAt: new Date(), completedAt: null },
        });
        return { existing: null, conversation, job };
      }
      const conversation = input.conversationId
        ? await tx.setupConversation.findFirst({
            where: {
              id: input.conversationId,
              tenantId: actor.tenantId,
              userId: actor.userId,
              locationId,
            },
          })
        : await tx.setupConversation.create({
            data: { tenantId: actor.tenantId, userId: actor.userId, locationId },
          });
      if (!conversation)
        throw new ApiError(404, 'Start a new setup conversation for this location.', 'NOT_FOUND');
      const job = await tx.generationJob.create({
        data: {
          tenantId: actor.tenantId,
          userId: actor.userId,
          kind: 'SETUP_CHAT',
          status: 'RUNNING',
          startedAt: new Date(),
          idempotencyKey: key,
          model: AI_MODEL,
          promptVersion: SETUP_PROMPT_VERSION,
          result: { conversationId: conversation.id, messageHash },
        },
      });
      return { existing: null, conversation, job };
    });
    const existing = prepared.existing;
    if (existing) {
      const payload =
        existing.result && typeof existing.result === 'object' && !Array.isArray(existing.result)
          ? existing.result
          : {};
      if (existing.status === 'COMPLETE') return json({ ...payload, messageHash: undefined });
      return json(
        {
          conversationId: prepared.conversation!.id,
          generationId: existing.id,
          jobId: existing.id,
          status: existing.status.toLowerCase(),
          errorCode: existing.errorCode,
        },
        202,
      );
    }
    let conversation = prepared.conversation!;
    const job = prepared.job!;
    await appendSetupMessage(conversation.id, actor.tenantId, {
      id: `${job.id}:user`,
      role: 'user',
      text: input.message,
      createdAt: new Date().toISOString(),
    });
    const appUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.url);
    const host = new URL(appUrl).origin;
    const client = new Client({
      host,
      redirect: 'error',
      headers: {
        cookie: request.headers.get('cookie') || '',
        origin: host,
        'x-dripwell-setup-conversation-id': conversation.id,
      },
    });
    try {
      if (!conversation.eveSessionId) {
        const { session } = await client.sessions.create();
        // Binding happens before the first turn, so tools cannot attach a draft to
        // an arbitrary client-supplied session or another owner's conversation.
        const bound = await db.setupConversation.updateMany({
          where: {
            id: conversation.id,
            tenantId: actor.tenantId,
            userId: actor.userId,
            eveSessionId: null,
          },
          data: { eveSessionId: session.state.sessionId },
        });
        if (!bound.count)
          conversation = await db.setupConversation.findUniqueOrThrow({
            where: { id: conversation.id },
          });
        else conversation = { ...conversation, eveSessionId: session.state.sessionId };
      }
      const session = client.sessions.attach(conversation.eveSessionId!);
      const response = await session.send(input.message, { signal: AbortSignal.timeout(240000) });
      const result = await response.result();
      if (result.status === 'failed' || !result.message) throw new Error('SETUP_RESPONSE_FAILED');
      const completedMessage = result.events
        .filter((event) => event.type === 'message.completed')
        .at(-1);
      await appendSetupMessage(conversation.id, actor.tenantId, {
        id: completedMessage
          ? `${result.sessionId}:${completedMessage.data.turnId}:${completedMessage.data.stepIndex}:assistant`
          : `${job.id}:assistant`,
        role: 'assistant',
        text: result.message,
        createdAt: new Date().toISOString(),
      });
      const updated = await db.setupConversation.findFirstOrThrow({
        where: { id: conversation.id, tenantId: actor.tenantId, userId: actor.userId },
      });
      const draft = setupProposalSchema.safeParse(updated.draft);
      const output = {
        conversationId: conversation.id,
        assistantMessage: result.message,
        draft: draft.success ? draft.data : null,
        missingQuestions: draft.success ? draft.data.missingQuestions : [],
        generationId: job.id,
        eveSessionId: conversation.eveSessionId,
        activeConfigurationChanged: false,
      };
      const usageEvents = result.events
        .filter((event) => event.type === 'step.completed')
        .map((event) => ({ stepIndex: event.data.stepIndex, usage: event.data.usage ?? null }));
      const inputTokens = usageEvents.reduce(
        (sum, step) => sum + (step.usage?.inputTokens ?? 0),
        0,
      );
      const outputTokens = usageEvents.reduce(
        (sum, step) => sum + (step.usage?.outputTokens ?? 0),
        0,
      );
      const measured =
        usageEvents.length > 0 && usageEvents.every((step) => step.usage?.costUsd != null);
      const usage = {
        inputTokens,
        outputTokens,
        steps: usageEvents,
        costUsd: measured ? usageEvents.reduce((sum, step) => sum + step.usage!.costUsd!, 0) : null,
        estimatedCostCents: estimateTextCost(AI_MODEL, { inputTokens, outputTokens }),
      };
      await db.generationJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETE',
          result: jsonValue({ ...output, messageHash }),
          usage: jsonValue(usage),
          completedAt: new Date(),
        },
      });
      return json(output);
    } catch (error) {
      const code = safeAIError(error);
      await db.generationJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorCode: code, completedAt: new Date() },
      });
      throw new ApiError(
        503,
        'Setup assistant could not complete this message. Your conversation is saved. Retry when the connection is ready.',
        code,
      );
    }
  },
  { mutation: true },
);
