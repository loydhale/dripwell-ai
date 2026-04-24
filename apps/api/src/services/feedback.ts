import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';

export interface CreateFeedbackInput {
  tenantId: string;
  submitterId: string;
  type: 'BUG' | 'FEATURE_REQUEST' | 'GENERAL';
  title: string;
  description: string;
  urgency: string;
}

export interface FeedbackSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  submitterId: string;
  submitterName: string;
  type: string;
  title: string;
  description: string;
  urgency: string;
  status: string;
  category: string | null;
  decision: string | null;
  priority: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  notes: string | null;
  promotedTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function createFeedback(data: CreateFeedbackInput): Promise<FeedbackSummary> {
  const feedback = await prisma.feedback.create({
    data: {
      tenantId: data.tenantId,
      submitterId: data.submitterId,
      type: data.type,
      title: data.title,
      description: data.description,
      urgency: data.urgency,
    },
    include: {
      tenant: { select: { name: true } },
      submitter: { select: { firstName: true, lastName: true } },
    },
  });

  return mapFeedback(feedback);
}

export async function listFeedbackForTenant(tenantId: string): Promise<FeedbackSummary[]> {
  const items = await prisma.feedback.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: { select: { name: true } },
      submitter: { select: { firstName: true, lastName: true } },
    },
  });

  return items.map(mapFeedback);
}

export async function listAllFeedback(options: {
  status?: string;
  category?: string;
  decision?: string;
  priority?: string;
  tenantId?: string;
  search?: string;
  page: number;
  limit: number;
}): Promise<{ items: FeedbackSummary[]; total: number }> {
  const where: Record<string, unknown> = {};

  if (options.status) {
    where.status = options.status;
  }
  if (options.category) {
    where.category = options.category;
  }
  if (options.decision) {
    where.decision = options.decision;
  }
  if (options.priority) {
    where.priority = options.priority;
  }
  if (options.tenantId) {
    where.tenantId = options.tenantId;
  }
  if (options.search) {
    where.OR = [
      { title: { contains: options.search, mode: 'insensitive' } },
      { description: { contains: options.search, mode: 'insensitive' } },
    ];
  }

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: options.limit,
      include: {
        tenant: { select: { name: true } },
        submitter: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.feedback.count({ where }),
  ]);

  return { items: items.map(mapFeedback), total };
}

export interface UpdateFeedbackInput {
  status?: 'BACKLOG' | 'IN_PROGRESS' | 'DONE' | 'WONT_DO';
  category?: 'SOFTWARE_ISSUE' | 'PROCESS_ISSUE' | 'DOCUMENTATION' | 'OTHER';
  decision?: 'DO_IT' | 'DONT_DO_IT' | 'MAYBE' | 'NEEDS_MORE_INFO';
  priority?: 'P0' | 'P1' | 'P2';
  assignedTo?: string | null;
  notes?: string;
  promotedTaskId?: string;
}

export async function updateFeedback(
  id: string,
  data: UpdateFeedbackInput
): Promise<FeedbackSummary> {
  const existing = await prisma.feedback.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Feedback');
  }

  const updateData: Record<string, unknown> = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.decision !== undefined) updateData.decision = data.decision;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.promotedTaskId !== undefined) updateData.promotedTaskId = data.promotedTaskId;

  const feedback = await prisma.feedback.update({
    where: { id },
    data: updateData,
    include: {
      tenant: { select: { name: true } },
      submitter: { select: { firstName: true, lastName: true } },
    },
  });

  return mapFeedback(feedback);
}

export async function getFeedbackById(id: string): Promise<FeedbackSummary> {
  const feedback = await prisma.feedback.findUnique({
    where: { id },
    include: {
      tenant: { select: { name: true } },
      submitter: { select: { firstName: true, lastName: true } },
    },
  });

  if (!feedback) {
    throw new NotFoundError('Feedback');
  }

  return mapFeedback(feedback);
}

function mapFeedback(
  feedback: {
    id: string;
    tenantId: string;
    tenant: { name: string };
    submitterId: string;
    submitter: { firstName: string; lastName: string };
    type: string;
    title: string;
    description: string;
    urgency: string;
    status: string;
    category: string | null;
    decision: string | null;
    priority: string | null;
    assignedTo: string | null;
    notes: string | null;
    promotedTaskId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): FeedbackSummary {
  return {
    id: feedback.id,
    tenantId: feedback.tenantId,
    tenantName: feedback.tenant.name,
    submitterId: feedback.submitterId,
    submitterName: `${feedback.submitter.firstName} ${feedback.submitter.lastName}`,
    type: feedback.type,
    title: feedback.title,
    description: feedback.description,
    urgency: feedback.urgency,
    status: feedback.status,
    category: feedback.category,
    decision: feedback.decision,
    priority: feedback.priority,
    assignedTo: feedback.assignedTo,
    assignedToName: null,
    notes: feedback.notes,
    promotedTaskId: feedback.promotedTaskId,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}
