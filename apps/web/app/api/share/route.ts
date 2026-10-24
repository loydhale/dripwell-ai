import { z } from 'zod';
import { requireClinic } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { apiRoute, json, readJson } from '@/lib/http';
import { createShare } from '@/lib/sharing';
export const runtime = 'nodejs';
export const GET = apiRoute(async (request) => {
  const actor = await requireClinic();
  const consultationId = z
    .string()
    .uuid()
    .parse(new URL(request.url).searchParams.get('consultationId'));
  const consultation = await getDb().consultation.findFirst({
    where: { id: consultationId, tenantId: actor.tenantId },
    select: { id: true },
  });
  if (!consultation) throw new ApiError(404, 'Consultation not found.');
  const shares = await getDb().shareLink.findMany({
    where: { tenantId: actor.tenantId, takeaway: { consultationId } },
    select: { id: true, recipientEmail: true, expiresAt: true, revokedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return json({ shares });
});
export const POST = apiRoute(
  async (request) => {
    const actor = await requireClinic();
    const body = await readJson(
      request,
      z
        .object({
          consultationId: z.string().uuid(),
          recipientEmail: z.email().max(254),
          expiresHours: z.number().int().min(1).max(720).optional(),
        })
        .strict(),
    );
    return json(await createShare(actor.tenantId, actor.userId, body), 201);
  },
  { mutation: true },
);
