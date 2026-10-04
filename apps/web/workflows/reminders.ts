import { sleep } from 'workflow';
import { start } from 'workflow/api';
import { getDb } from '../lib/db';

export async function reconcileConsultationReminders(consultationId: string) {
  'use step';
  return getDb().$transaction(async (db) => {
    await db.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${consultationId}::uuid FOR UPDATE`;
    const consultation = await db.consultation.findUnique({ where: { id: consultationId } });
    if (!consultation || consultation.isTest) return { nextDueAt: null as string | null };
    const now = new Date();
    const conditions = [
      {
        type: 'CARE_OUTCOME_NEEDED' as const,
        needed: consultation.careOutcome === 'PENDING',
        dueAt: consultation.careOutcomeDueAt,
        title: 'Care outcome needed',
        message: 'Record whether care started, did not start, or remains pending.',
      },
      {
        type: 'WELLNESS_DECISION_NEEDED' as const,
        needed:
          Boolean(consultation.wellnessPlan) &&
          (!consultation.wellnessDecision ||
            consultation.wellnessDecision === 'TBD' ||
            consultation.wellnessDecisionRevision !== consultation.wellnessRevision ||
            consultation.wellnessApprovedVersion !== consultation.wellnessRevision),
        dueAt: consultation.wellnessDecisionDueAt,
        title: 'Wellness decision needed',
        message: 'Record the client’s wellness decision when it is known.',
      },
    ];
    const futureDates: Date[] = [];
    for (const condition of conditions) {
      if (consultation.archivedAt || !condition.needed || !condition.dueAt) {
        await db.notification.updateMany({
          where: {
            tenantId: consultation.tenantId,
            consultationId,
            type: condition.type,
            dismissedAt: null,
          },
          data: { dismissedAt: now },
        });
        continue;
      }
      if (condition.dueAt > now) {
        futureDates.push(condition.dueAt);
        continue;
      }
      const idempotencyKey = `reminder:${consultationId}:${condition.type}:${condition.dueAt.toISOString()}`;
      await db.notification.upsert({
        where: { idempotencyKey },
        create: {
          tenantId: consultation.tenantId,
          userId: consultation.providerId,
          consultationId,
          entityId: consultationId,
          type: condition.type,
          title: condition.title,
          message: condition.message,
          dueAt: condition.dueAt,
          idempotencyKey,
        },
        update: { userId: consultation.providerId, dismissedAt: null },
      });
    }
    return {
      nextDueAt: futureDates.length
        ? new Date(Math.min(...futureDates.map((d) => d.getTime()))).toISOString()
        : null,
    };
  });
}

export async function consultationReminderWorkflow(consultationId: string) {
  'use workflow';
  let state = await reconcileConsultationReminders(consultationId);
  while (state.nextDueAt) {
    await sleep(new Date(state.nextDueAt));
    state = await reconcileConsultationReminders(consultationId);
  }
  return { consultationId };
}

export async function startConsultationReminder(consultationId: string) {
  const run = await start(consultationReminderWorkflow, [consultationId]);
  return { runId: run.runId };
}

export async function reconcileAllReminders() {
  const db = getDb();
  let cursor: string | undefined;
  let count = 0;
  do {
    const consultations = await db.consultation.findMany({
      where: {
        isTest: false,
        OR: [
          { careOutcome: 'PENDING' },
          { wellnessDecision: null },
          { wellnessDecision: 'TBD' },
          { wellnessDecisionDueAt: { not: null } },
          { notifications: { some: { dismissedAt: null } } },
        ],
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (let offset = 0; offset < consultations.length; offset += 10) {
      await Promise.all(
        consultations
          .slice(offset, offset + 10)
          .map((consultation) => reconcileConsultationReminders(consultation.id)),
      );
    }
    count += consultations.length;
    cursor = consultations.length === 100 ? consultations.at(-1)?.id : undefined;
  } while (cursor);
  return { checked: count, moreRemaining: Boolean(cursor) };
}
