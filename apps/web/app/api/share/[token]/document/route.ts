import { apiRoute, privateHeaders } from '@/lib/http';
import { sharedDocument, takeawayPdf } from '@/lib/sharing';
export const runtime = 'nodejs';
export const GET = apiRoute(async (_request, context: { params: Promise<{ token: string }> }) => {
  const document = await sharedDocument((await context.params).token);
  const bytes = await takeawayPdf(document);
  await sharedDocument((await context.params).token);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      ...privateHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="wellness-visit.pdf"',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
});
