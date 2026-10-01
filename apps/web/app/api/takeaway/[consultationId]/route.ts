import { z } from 'zod';
import { requireClinic } from '@/lib/auth';
import { apiRoute, privateHeaders } from '@/lib/http';
import { approvedTakeaway, readTakeaway, takeawayPdf } from '@/lib/sharing';
import { ApiError } from '@/lib/errors';
export const runtime = 'nodejs';
export const GET = apiRoute(
  async (_request, context: { params: Promise<{ consultationId: string }> }) => {
    const actor = await requireClinic();
    const consultationId = z
      .string()
      .uuid()
      .parse((await context.params).consultationId);
    const snapshot = await approvedTakeaway(actor.tenantId, consultationId, actor.userId);
    const bytes = await takeawayPdf(readTakeaway(snapshot));
    const current = await approvedTakeaway(actor.tenantId, consultationId, actor.userId);
    if (current.id !== snapshot.id)
      throw new ApiError(
        409,
        'The document changed while it was prepared. Please download the approved revision again.',
      );
    return new Response(bytes as unknown as BodyInit, {
      headers: {
        ...privateHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="wellness-visit.pdf"',
        'Referrer-Policy': 'no-referrer',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  },
);
