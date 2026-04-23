import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { getPhotoStorage } from '../lib/storage.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
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
import { generateRecommendation } from '../services/recommendations.js';
import type { UserPayload } from '../types/index.js';
import {
  makeAssessmentId,
  makeTenantId,
  makeProviderId,
  makeLocationId,
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
        data: {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          assessmentSessionId: id,
          action: 'PHOTO_CAPTURED',
          entityType: 'PhotoCapture',
          entityId: photoCapture.id,
          details: { angle, url: stored.url },
        },
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
          data: {
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
          },
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

      if (assessment.status === 'COMPLETED' || assessment.status === 'ABANDONED') {
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

      if (assessment.status === 'COMPLETED' || assessment.status === 'ABANDONED') {
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
        data: {
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
        },
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
        data: { status: 'COMPLETED', completedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
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
        },
      });

      const confidenceRecord: Record<string, number> = {};
      for (const c of confidences) {
        confidenceRecord[c.pattern] = c.confidence;
      }

      reply.status(200);
      return {
        status: 'COMPLETED',
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

      // Compute pattern matches
      const patternResult = await computePatternMatches({
        assessmentSessionId: id,
        tenantId: userPayload.tenantId,
        mockSignals: RECOMMENDATION_MOCK_MODE || QUESTION_MOCK_MODE,
      });

      if (patternResult.topPatterns.length === 0) {
        throw new ValidationError([{ message: 'No clinical patterns could be matched for this assessment' }]);
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

      await prisma.auditLog.create({
        data: {
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
        },
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
}
