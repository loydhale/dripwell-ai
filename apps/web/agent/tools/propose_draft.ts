import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getDb } from '../../lib/db';
import { verifiedOwner } from '../lib/scope';

export const setupProposalSchema = z.object({
  clinicName: z.string().max(200).nullable(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable(),
  products: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE', 'SERVICE', 'MEMBERSHIP']),
        priceCents: z.number().int().min(0).max(100000000).nullable(),
        currency: z
          .string()
          .regex(/^[A-Z]{3}$/)
          .nullable(),
        description: z.string().max(4000),
        ingredients: z
          .array(z.object({ name: z.string().max(200), quantity: z.string().max(200).nullable() }))
          .max(100),
        benefits: z.array(z.string().max(2000)).max(100),
        terms: z.string().max(4000),
        sourceQuote: z.string().max(4000),
        gaps: z.array(z.string().max(1000)).max(100),
      }),
    )
    .max(1000),
  questions: z
    .array(
      z.object({
        text: z.string().max(1000),
        why: z.string().max(2000),
        sourceQuote: z.string().max(4000),
      }),
    )
    .max(500),
  protocolNotes: z.array(z.string().max(4000)).max(100),
  missingQuestions: z.array(z.string().max(2000)).max(100),
});

export default defineTool({
  description:
    'Save an organized setup proposal only, with source quotes and unknown prices left null. This cannot change active clinic configuration, clinical validation, or billing.',
  inputSchema: setupProposalSchema,
  async execute(proposal, ctx) {
    const { tenantId, userId, locationId } = await verifiedOwner(ctx);
    const conversation = await getDb().setupConversation.findFirst({
      where: { tenantId, userId, locationId, eveSessionId: ctx.session.id },
    });
    if (!conversation) throw new Error('SETUP_CONVERSATION_NOT_BOUND');
    await getDb().setupConversation.updateMany({
      where: { id: conversation.id, tenantId, userId, locationId },
      data: { draft: proposal as unknown as Prisma.InputJsonValue },
    });
    return {
      conversationId: conversation.id,
      saved: true,
      activeConfigurationChanged: false,
      missingQuestions: proposal.missingQuestions,
    };
  },
});
