import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { getPhotoStorage } from '../lib/storage.js';
import { NotFoundError, ForbiddenError, ValidationError, ConflictError } from '../lib/errors.js';
import { analyzePhotos, isConfidenceAcceptable, toPrismaSignalName } from '../services/vision.js';
import {
  STATIC_QUESTION_BANK,
  QUESTION_MOCK_MODE,
  selectNextQuestion,
  computePatternConfidences,
  recordAnswer,
  getAssessmentSignals,
  getAssessmentAnswers,
  formatConfidenceLog,
} from '../services/questions.js';
import { computePatternMatches, persistPatternMatches, RECOMMENDATION_MOCK_MODE } from '../services/patterns.js';
import {
  generateRecommendation,
  getPendingRecommendation,
  approveRecommendation,
  overrideRecommendation,
  modifyRecommendation,
} from '../services/recommendations.js';
import {
  detectSafetyFlags,
  persistSafetyFlags,
  getSafetyFlags,
  acknowledgeSafetyFlag,
  hasUnacknowledgedTier3Flags,
  auditSafetyFlags,
  SAFETY_MOCK_MODE,
} from '../services/safety.js';
import type { UserPayload } from '../types/index.js';
import {
  makeAssessmentId,
  makeTenantId,
  makeProviderId,
  makeLocationId,
  makeCatalogItemId,
} from '@dripwell/shared';

const createAssessmentSchema = z.object({
  locationId: z.string().uuid().optional(),
});

const photoAngleSchema = z.enum(['FACE', 'UNDER_EYES', 'HAND_FOREARM', 'TONGUE']);

const answerSchema = z.object({
  questionId: z.string().uuid(),
  answerValue: z.string().min(1),
  skipped: z.boolean().optional().default(false),
});

const acknowledgeFlagSchema = z.object({
  acknowledged: z.boolean(),
});

const approveSchema = z.object({
  notes: z.string().optional(),
});

const overrideSchema = z.object({
  reason: z.enum(['CLINICAL_JUDGEMENT', 'PATIENT_PREFERENCE', 'CONTRAINDICATION', 'OTHER']),
  reasonNote: z.string().optional(),
  manualRecommendation: z.string().optional(),
});

const modifySchema = z.object({
  primaryCatalogItemId: z.string().uuid().optional(),
  rationale: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

function buildAuditLogData(userPayload: UserPayload, base: object) {
  return {
    ...base,
    impersonatedBy: userPayload.impersonatedBy || null,
  } as any;
}

export default async function assessmentRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/assessments',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const data = parseBody(createAssessmentSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.create({
        data: {
          tenantId: userPayload.tenantId,
          providerId: userPayload.userId,
          locationId: data.locationId,
          status: 'IN_PROGRESS',
        },
      });

      return { assessment };
    }
  );

  fastify.get(
    '/assessments',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessments = await prisma.assessmentSession.findMany({
        where: {
          tenantId: userPayload.tenantId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { assessments };
    }
  );

  fastify.get(
    '/assessments/:id',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      return { assessment };
    }
  );

  fastify.post(
    '/assessments/:id/photos',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const data = await request.file();
      if (!data) {
        throw new ValidationError([{ message: 'Photo file is required' }]);
      }

      const angleRaw = (data.fields.angle as { value?: string } | undefined)?.value;
      const angleResult = photoAngleSchema.safeParse(angleRaw);
      if (!angleResult.success) {
        throw new ValidationError([{ message: 'Invalid or missing photo angle. Must be one of: FACE, UNDER_EYES, HAND_FOREARM, TONGUE' }]);
      }
      const angle = angleResult.data;

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const storage = getPhotoStorage();
      const stored = await storage.savePhoto({
        buffer,
        angle,
        assessmentId: id,
        tenantId: userPayload.tenantId,
        mimeType: data.mimetype,
      });

      const photoCapture = await prisma.photoCapture.create({
        data: {
          assessmentSessionId: id,
          tenantId: userPayload.tenantId,
          angle,
          url: stored.url,
          uploadedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PHOTO_CAPTURED',
          entityType: 'PhotoCapture',
          entityId: photoCapture.id,
          details: { angle, url: stored.url },
        }),
      });

      reply.status(201);
      return { photoCapture };
    }
  );

  fastify.post(
    '/assessments/:id/analyze-photos',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const photos = await prisma.photoCapture.findMany({
        where: {
          assessmentSessionId: id,
          tenantId: userPayload.tenantId,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (photos.length === 0) {
        throw new ValidationError([{ message: 'No photos found for this assessment session' }]);
      }

      const analysis = await analyzePhotos({ photos });

      const createdSignals = [];
      for (const result of analysis.results) {
        for (const signal of result.signals) {
          const prismaName = toPrismaSignalName(signal.name);
          if (!prismaName) {
            continue;
          }

          const isLowConfidence = !isConfidenceAcceptable(signal.confidence);

          const visualSignal = await prisma.visualSignal.create({
            data: {
              assessmentSessionId: id,
              tenantId: userPayload.tenantId,
              photoCaptureId: result.photoCaptureId,
              signalName: prismaName as any,
              confidence: signal.confidence,
              value: signal.value || null,
              rawJson: result.rawResponse as unknown as object,
            },
          });

          createdSignals.push({
            ...visualSignal,
            isLowConfidence,
          });
        }

        await prisma.auditLog.create({
          data: buildAuditLogData(userPayload, {
            tenantId: userPayload.tenantId,
            userId: userPayload.userId,
            assessmentSessionId: id,
            action: 'SIGNAL_EXTRACTED',
            entityType: 'VisualSignal',
            entityId: result.photoCaptureId,
            details: {
              angle: result.angle,
              signalCount: result.signals.length,
              tokenUsage: result.tokenUsage as unknown as object,
              rawResponse: result.rawResponse,
            } as unknown as object,
          }),
        });
      }

      reply.status(200);
      return {
        analysis: {
          totalPhotos: analysis.totalPhotos,
          totalSignals: analysis.totalSignals,
          lowConfidenceCount: analysis.lowConfidenceCount,
        },
        signals: createdSignals,
      };
    }
  );

  fastify.get(
    '/assessments/:id/next-question',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status === 'PENDING_REVIEW' || assessment.status === 'APPROVED' || assessment.status === 'OVERRIDDEN' || assessment.status === 'COMPLETED' || assessment.status === 'ABANDONED') {
        throw new ValidationError([{ message: `Assessment is already ${assessment.status.toLowerCase()}` }]);
      }

      const signals = await getAssessmentSignals(id, userPayload.tenantId);
      const answers = await getAssessmentAnswers(id, userPayload.tenantId);

      const result = selectNextQuestion({
        signals,
        answers,
        mockSignals: QUESTION_MOCK_MODE || signals.length === 0,
      });

      fastify.log.info({
        assessmentId: id,
        action: 'NEXT_QUESTION',
        questionId: result.question?.id ?? null,
        shouldTerminate: result.shouldTerminate,
        confidences: formatConfidenceLog(result.patternConfidences),
      });

      const questionOut = result.question
        ? {
            id: result.question.id,
            category: result.question.category,
            questionText: result.question.questionText,
            answerType: result.question.answerType,
            answerOptions: result.question.answerOptions,
            isOptional: true,
          }
        : null;

      const confidenceRecord: Record<string, number> = {};
      for (const c of result.patternConfidences) {
        confidenceRecord[c.pattern] = c.confidence;
      }

      return {
        question: questionOut,
        progress: result.progress,
        patternConfidences: confidenceRecord,
        shouldTerminate: result.shouldTerminate,
        terminationReason: result.terminationReason,
      };
    }
  );

  fastify.post(
    '/assessments/:id/answer',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status === 'PENDING_REVIEW' || assessment.status === 'APPROVED' || assessment.status === 'OVERRIDDEN' || assessment.status === 'COMPLETED' || assessment.status === 'ABANDONED') {
        throw new ValidationError([{ message: `Assessment is already ${assessment.status.toLowerCase()}` }]);
      }

      const data = parseBody(answerSchema)(request.body);
      const question = STATIC_QUESTION_BANK.find((q) => q.id === data.questionId);
      if (!question) {
        throw new ValidationError([{ message: 'Unknown question ID' }]);
      }

      const answerValue = data.skipped ? 'skipped' : data.answerValue;

      // Compute confidence delta for audit / transparency
      const priorAnswers = await getAssessmentAnswers(id, userPayload.tenantId);
      const priorConfidences = computePatternConfidences({
        signals: await getAssessmentSignals(id, userPayload.tenantId),
        answers: priorAnswers,
        mockSignals: QUESTION_MOCK_MODE,
      });

      const newAnswer = await recordAnswer({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        questionBankId: question.id,
        questionText: question.questionText,
        answerValue,
        answerType: question.answerType,
        confidenceDelta: null,
      });

      const postAnswers = [...priorAnswers, { questionBankId: question.id, answerValue }];
      const postConfidences = computePatternConfidences({
        signals: await getAssessmentSignals(id, userPayload.tenantId),
        answers: postAnswers,
        mockSignals: QUESTION_MOCK_MODE,
      });

      const topPrior = priorConfidences.sort((a, b) => b.confidence - a.confidence)[0];
      const topPost = postConfidences.sort((a, b) => b.confidence - a.confidence)[0];
      const confidenceDelta = topPost.confidence - topPrior.confidence;

      // Update the answer with the computed delta
      await prisma.questionAnswer.update({
        where: { id: newAnswer.id },
        data: { confidenceDelta },
      });

      const nextResult = selectNextQuestion({
        signals: await getAssessmentSignals(id, userPayload.tenantId),
        answers: postAnswers,
        mockSignals: QUESTION_MOCK_MODE,
      });

      fastify.log.info({
        assessmentId: id,
        action: 'QUESTION_ANSWERED',
        questionId: question.id,
        answerValue,
        skipped: data.skipped,
        confidenceDelta,
        topPattern: topPost.pattern,
        topConfidence: topPost.confidence,
        confidences: formatConfidenceLog(postConfidences),
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'QUESTION_ANSWERED',
          entityType: 'QuestionAnswer',
          entityId: newAnswer.id,
          details: {
            questionId: question.id,
            answerValue,
            skipped: data.skipped,
            confidenceDelta,
          },
        }),
      });

      const confidenceRecord: Record<string, number> = {};
      for (const c of postConfidences) {
        confidenceRecord[c.pattern] = c.confidence;
      }

      const nextQuestionOut = nextResult.question
        ? {
            id: nextResult.question.id,
            category: nextResult.question.category,
            questionText: nextResult.question.questionText,
            answerType: nextResult.question.answerType,
            answerOptions: nextResult.question.answerOptions,
            isOptional: true,
          }
        : null;

      reply.status(201);
      return {
        answer: {
          id: newAnswer.id,
          questionBankId: newAnswer.questionBankId,
          answerValue: newAnswer.answerValue,
          confidenceDelta: newAnswer.confidenceDelta,
          answeredAt: newAnswer.answeredAt,
        },
        patternConfidences: confidenceRecord,
        shouldTerminate: nextResult.shouldTerminate,
        terminationReason: nextResult.terminationReason,
        nextQuestion: nextQuestionOut,
      };
    }
  );

  fastify.post(
    '/assessments/:id/end-questioning',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const answers = await getAssessmentAnswers(id, userPayload.tenantId);
      const signals = await getAssessmentSignals(id, userPayload.tenantId);
      const confidences = computePatternConfidences({
        signals,
        answers,
        mockSignals: QUESTION_MOCK_MODE,
      });

      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'PENDING_REVIEW', completedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'ASSESSMENT_COMPLETED',
          entityType: 'AssessmentSession',
          entityId: id,
          details: {
            event: 'PROVIDER_ENDED_QUESTIONING',
            answersCount: answers.length,
            finalConfidences: confidences.map((c) => ({
              pattern: c.pattern,
              confidence: c.confidence,
            })),
          },
        }),
      });

      await prisma.notification.create({
        data: {
          tenantId: userPayload.tenantId,
          title: 'Assessment completed',
          message: `A new assessment has been completed and is pending review.`,
          type: 'ASSESSMENT_COMPLETED',
          entityId: id,
        },
      });

      const confidenceRecord: Record<string, number> = {};
      for (const c of confidences) {
        confidenceRecord[c.pattern] = c.confidence;
      }

      reply.status(200);
      return {
        status: 'PENDING_REVIEW',
        patternConfidences: confidenceRecord,
        answersCount: answers.length,
      };
    }
  );

  fastify.post(
    '/assessments/:id/generate-recommendation',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status === 'APPROVED' || assessment.status === 'OVERRIDDEN' || assessment.status === 'ABANDONED') {
        throw new ValidationError([{ message: `Assessment is already ${assessment.status.toLowerCase()}` }]);
      }

      // Compute pattern matches
      const patternResult = await computePatternMatches({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        mockSignals: RECOMMENDATION_MOCK_MODE || QUESTION_MOCK_MODE,
      });

      if (patternResult.topPatterns.length === 0) {
        throw new ValidationError([{ message: 'No clinical patterns could be matched for this assessment' }]);
      }

      // Detect safety flags and persist them
      const safetyResult = await detectSafetyFlags({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        mockMode: SAFETY_MOCK_MODE || QUESTION_MOCK_MODE,
      });

      if (safetyResult.flags.length > 0) {
        await persistSafetyFlags({
          assessmentSessionId: id,
          tenantId: userPayload.tenantId,
          flags: safetyResult.flags,
        });

        await auditSafetyFlags({
          assessmentSessionId: id,
          tenantId: userPayload.tenantId,
          providerId: userPayload.userId,
          flags: safetyResult.flags,
          impersonatedBy: userPayload.impersonatedBy,
        });
      }

      // Block recommendation generation if unacknowledged Tier 3 flags exist
      const blockedByTier3 = await hasUnacknowledgedTier3Flags({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
      });

      if (blockedByTier3) {
        throw new ConflictError('Assessment has unacknowledged urgent safety flags. Provider must review and acknowledge before generating a recommendation.');
      }

      // Persist pattern matches
      await persistPatternMatches({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        patterns: patternResult.topPatterns,
      });

      // Generate recommendation
      const recommendationResult = await generateRecommendation({
        assessmentSessionId: makeAssessmentId(id),
        tenantId: makeTenantId(userPayload.tenantId),
        providerId: makeProviderId(userPayload.userId),
        locationId: assessment.locationId ? makeLocationId(assessment.locationId) : null,
        topPattern: patternResult.topPatterns[0],
        allPatterns: patternResult.topPatterns,
        isReturning: assessment.isReturning,
        priorSessionId: assessment.priorSessionId ? makeAssessmentId(assessment.priorSessionId) : null,
      });

      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'PENDING_REVIEW' },
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'RECOMMENDATION_GENERATED',
          entityType: 'Recommendation',
          entityId: recommendationResult.recommendationId,
          details: {
            patternName: recommendationResult.patternName,
            confidence: recommendationResult.confidence,
            primaryItemId: recommendationResult.primaryItem.catalogItemId,
            intent: recommendationResult.genericIntent,
          },
        }),
      });

      reply.status(201);
      return {
        recommendation: {
          id: recommendationResult.recommendationId,
          primaryItem: recommendationResult.primaryItem,
          alternatives: recommendationResult.alternatives,
          confidence: recommendationResult.confidence,
          rationale: recommendationResult.rationale,
          patternName: recommendationResult.patternName,
          genericIntent: recommendationResult.genericIntent,
        },
        patterns: patternResult.topPatterns.map((p) => ({
          clinicalPatternId: p.clinicalPatternId,
          clinicalPatternName: p.clinicalPatternName,
          confidence: p.confidence,
          category: p.category,
          matchedSignals: p.matchedSignals,
          matchedAnswers: p.matchedAnswers,
          isPrimary: p.isPrimary,
        })),
        allConfidences: patternResult.allConfidences,
      };
    }
  );

  fastify.get(
    '/assessments/:id/safety-flags',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const flags = await getSafetyFlags({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
      });

      return {
        flags: flags.map((f) => ({
          id: f.id,
          tier: f.tier,
          flagType: f.flagType,
          description: f.description,
          suggestedScript: f.suggestedScript,
          providerAcknowledgedAt: f.providerAcknowledgedAt,
          isOverridden: f.isOverridden,
          createdAt: f.createdAt,
        })),
        hasUnacknowledgedTier3: flags.some(
          (f) => f.tier === 'T3_URGENT' && !f.providerAcknowledgedAt && !f.isOverridden
        ),
      };
    }
  );

  fastify.post(
    '/assessments/:id/safety-flags/:flagId/acknowledge',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id, flagId } = request.params as { id: string; flagId: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const data = parseBody(acknowledgeFlagSchema)(request.body);
      if (!data.acknowledged) {
        throw new ValidationError([{ message: 'acknowledged must be true' }]);
      }

      const updated = await acknowledgeSafetyFlag({
        flagId,
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        providerId: userPayload.userId,
      });

      if (!updated) {
        throw new NotFoundError('Safety flag');
      }

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PROVIDER_APPROVED',
          entityType: 'SafetyFlag',
          entityId: flagId,
          details: {
            flagType: updated.flagType,
            tier: updated.tier,
            acknowledged: true,
          },
        }),
      });

      reply.status(200);
      return {
        flag: {
          id: updated.id,
          tier: updated.tier,
          flagType: updated.flagType,
          description: updated.description,
          suggestedScript: updated.suggestedScript,
          providerAcknowledgedAt: updated.providerAcknowledgedAt,
          isOverridden: updated.isOverridden,
        },
      };
    }
  );

  fastify.get(
    '/assessments/:id/recommendation',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      const rec = await getPendingRecommendation({
        assessmentSessionId: makeAssessmentId(id),
        tenantId: makeTenantId(userPayload.tenantId),
      });

      if (!rec) {
        throw new NotFoundError('Recommendation');
      }

      return { recommendation: rec };
    }
  );

  fastify.post(
    '/assessments/:id/approve',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status !== 'PENDING_REVIEW') {
        throw new ValidationError([{ message: `Assessment must be pending review to approve. Current status: ${assessment.status}` }]);
      }

      const data = parseBody(approveSchema)(request.body);

      const result = await approveRecommendation({
        assessmentSessionId: makeAssessmentId(id),
        tenantId: makeTenantId(userPayload.tenantId),
        providerId: makeProviderId(userPayload.userId),
      });

      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'APPROVED' },
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PROVIDER_APPROVED',
          entityType: 'Recommendation',
          entityId: result.recommendationId,
          details: {
            notes: data.notes || null,
          },
        }),
      });

      reply.status(200);
      return {
        recommendationId: result.recommendationId,
        status: 'APPROVED',
        patientOutput: result.patientOutput,
      };
    }
  );

  fastify.post(
    '/assessments/:id/override',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status !== 'PENDING_REVIEW') {
        throw new ValidationError([{ message: `Assessment must be pending review to override. Current status: ${assessment.status}` }]);
      }

      const data = parseBody(overrideSchema)(request.body);

      const result = await overrideRecommendation({
        assessmentSessionId: makeAssessmentId(id),
        tenantId: makeTenantId(userPayload.tenantId),
        providerId: makeProviderId(userPayload.userId),
        reason: data.reason,
        reasonNote: data.reasonNote,
        manualRecommendation: data.manualRecommendation,
      });

      await prisma.assessmentSession.update({
        where: { id },
        data: { status: 'OVERRIDDEN' },
      });

      await prisma.auditLog.create({
        data: buildAuditLogData(userPayload, {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PROVIDER_OVERRIDDEN',
          entityType: 'Recommendation',
          entityId: result.recommendationId,
          details: {
            overrideId: result.overrideId,
            reason: data.reason,
            reasonNote: data.reasonNote || null,
            manualRecommendation: data.manualRecommendation || null,
          },
        }),
      });

      reply.status(200);
      return {
        recommendationId: result.recommendationId,
        overrideId: result.overrideId,
        status: 'OVERRIDDEN',
      };
    }
  );

  fastify.post(
    '/assessments/:id/modify',
    { preValidation: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const assessment = await prisma.assessmentSession.findFirst({
        where: {
          id,
          tenantId: userPayload.tenantId,
        },
      });

      if (!assessment) {
        throw new NotFoundError('Assessment');
      }

      if (assessment.status !== 'PENDING_REVIEW' && assessment.status !== 'IN_PROGRESS') {
        throw new ValidationError([{ message: `Assessment must be in progress or pending review to modify. Current status: ${assessment.status}` }]);
      }

      const data = parseBody(modifySchema)(request.body);

      const result = await modifyRecommendation({
        assessmentSessionId: makeAssessmentId(id),
        tenantId: makeTenantId(userPayload.tenantId),
        providerId: makeProviderId(userPayload.userId),
        primaryCatalogItemId: data.primaryCatalogItemId ? makeCatalogItemId(data.primaryCatalogItemId) : undefined,
        rationale: data.rationale,
        confidence: data.confidence,
      });

      reply.status(200);
      return {
        recommendationId: result.recommendationId,
        status: 'MODIFIED',
        primaryItem: result.primaryItem,
        alternatives: result.alternatives,
        confidence: result.confidence,
        rationale: result.rationale,
      };
    }
  );
}
