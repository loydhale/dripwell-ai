import 'server-only';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { Resend } from 'resend';
import { z } from 'zod';
import { clinicConfigurationSchema, formatMoney, wellnessPlanSchema } from '@dripwell/shared/v2';
import { getDb } from './db';
import { ApiError } from './errors';
import { applicationUrl } from './billing';
import { rateLimit } from './rate-limit';

export const sharingWarning =
  "Contains private health information. Share only with the intended recipient using your clinic's HIPAA-compliant process. Downloaded copies cannot be remotely revoked.";
const itemSchema = z.object({
  name: z.string(),
  quantity: z.number().int(),
  priceCents: z.number().int(),
  currency: z.string(),
  rationale: z.string(),
  terms: z.string(),
});
export const legacyTakeawayDocumentSchema = z.object({
  version: z.literal(1),
  clinic: z.object({
    name: z.string(),
    contact: z.string(),
    brandColor: z.string().regex(/^#[\da-fA-F]{6}$/),
  }),
  reference: z.string(),
  visitDate: z.string(),
  approvedAt: z.string(),
  visitSummary: z.string(),
  explanation: z.string(),
  careOutcome: z.enum(['PENDING', 'STARTED', 'NOT_STARTED']),
  careReceived: z.array(itemSchema),
  offers: z.array(itemSchema),
  warning: z.string(),
});
const offerSchema = itemSchema.extend({
  benefits: z.array(z.string().max(2000)).max(100),
  matchedGoals: z.array(z.string().max(2000)).max(100),
});
export const currentTakeawayDocumentSchema = legacyTakeawayDocumentSchema.extend({
  version: z.literal(2),
  offers: z.array(offerSchema).max(100),
});
export const takeawayDocumentSchema = z.discriminatedUnion('version', [
  legacyTakeawayDocumentSchema,
  currentTakeawayDocumentSchema,
]);
export type TakeawayDocument = z.infer<typeof takeawayDocumentSchema>;
type DocumentItem = TakeawayDocument['offers'][number];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
const secret = () => randomBytes(32).toString('base64url');
const linkPattern = /^[A-Za-z0-9_-]{43}$/;
const privateCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

function publicItem(item: {
  name: string;
  quantity: number;
  priceCents: number;
  currency: string;
  rationale: string;
  terms: string;
}): z.infer<typeof itemSchema> {
  return {
    name: item.name,
    quantity: item.quantity,
    priceCents: item.priceCents,
    currency: item.currency,
    rationale: item.rationale,
    terms: item.terms,
  };
}

export function priceLabel(item: DocumentItem): string {
  return formatMoney(item.priceCents * item.quantity, item.currency);
}

async function unresolvedEvidence(
  db: Pick<Prisma.TransactionClient, 'recordingSegment' | 'generationJob'>,
  tenantId: string,
  consultationId: string,
): Promise<boolean> {
  const [recordings, jobs] = await Promise.all([
    db.recordingSegment.count({ where: {
      tenantId, consultationId, status: { notIn: ['TRANSCRIBED', 'DISCARDED'] },
    } }),
    db.generationJob.count({ where: {
      tenantId, consultationId,
      kind: { in: ['TRANSCRIPTION', 'SUMMARY', 'CONSULTATION_SUMMARY'] },
      status: { in: ['PENDING', 'QUEUING', 'RUNNING'] },
    } }),
  ]);
  return recordings > 0 || jobs > 0;
}

async function requireResolvedEvidence(
  db: Pick<Prisma.TransactionClient, 'recordingSegment' | 'generationJob'>,
  tenantId: string,
  consultationId: string,
): Promise<void> {
  if (await unresolvedEvidence(db, tenantId, consultationId)) {
    throw new ApiError(409, 'Finish processing and review the new recording before downloading or sharing this visit.', 'EVIDENCE_PROCESSING');
  }
}

export async function approvedTakeaway(tenantId: string, consultationId: string, userId: string) {
  const db = getDb();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${consultationId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const consultation = await tx.consultation.findFirst({
      where: { id: consultationId, tenantId },
      include: { configurationVersion: true, tenant: true },
    });
    if (!consultation || !consultation.tenant.isActive)
      throw new ApiError(404, 'Consultation not found.');
    await requireResolvedEvidence(tx, tenantId, consultationId);
    if (
      !consultation.wellnessRevision ||
      consultation.wellnessApprovedVersion !== consultation.wellnessRevision ||
      !consultation.wellnessApprovedAt ||
      consultation.wellnessSummaryRevision !== consultation.summaryRevision ||
      consultation.wellnessCareRevision !== consultation.careRevision
    ) {
      throw new ApiError(
        409,
        'Approve the current wellness plan before downloading or sharing it.',
        'WELLNESS_APPROVAL_REQUIRED',
      );
    }
    const existing = await tx.takeaway.findUnique({
      where: {
        consultationId_wellnessRevision: {
          consultationId,
          wellnessRevision: consultation.wellnessRevision,
        },
      },
    });
    if (existing) {
      if (existing.revokedAt || (existing.expiresAt && existing.expiresAt <= new Date()))
        throw new ApiError(410, 'This takeaway is no longer available.');
      return existing;
    }
    const configuration = clinicConfigurationSchema.parse(
      consultation.configurationVersion.payload,
    );
    const plan = wellnessPlanSchema.parse(consultation.wellnessPlan);
    const documentFields = {
      clinic: configuration.clinic,
      reference: consultation.reference,
      visitDate: consultation.createdAt.toISOString(),
      approvedAt: consultation.wellnessApprovedAt.toISOString(),
      visitSummary: plan.visitSummary,
      explanation: plan.explanation,
      careOutcome: plan.careReceived.outcome,
      careReceived: plan.careReceived.items.map(publicItem),
      warning: sharingWarning,
    };
    const document: TakeawayDocument = plan.engineVersion === 'dripwell-rules-v2.2'
      ? { ...documentFields, version: 2, offers: plan.offers.map(item => ({
          ...publicItem(item), benefits: [...item.benefits], matchedGoals: [...item.matchedGoals],
        })) }
      : { ...documentFields, version: 1, offers: plan.offers.map(publicItem) };
    const expiresAt = new Date(
      consultation.createdAt.getTime() + configuration.retention.documentDays * 86400000,
    );
    if (expiresAt <= new Date())
      throw new ApiError(410, 'This document has reached the clinic retention limit.');
    const takeaway = await tx.takeaway.create({
      data: {
        tenantId,
        consultationId,
        wellnessRevision: consultation.wellnessRevision,
        payload: document as unknown as Prisma.InputJsonValue,
        contentHash: hash(canonicalJson(document)),
        createdById: userId,
        expiresAt,
      },
    });
    await tx.consultationEvent.create({
      data: {
        tenantId,
        consultationId,
        userId,
        action: 'TAKEAWAY_CREATED',
        artifactRevision: consultation.wellnessRevision,
      },
    });
    return takeaway;
  });
}

export function readTakeaway(value: {
  payload: Prisma.JsonValue;
  contentHash: string;
}): TakeawayDocument {
  if (hash(canonicalJson(value.payload)) !== value.contentHash)
    throw new ApiError(409, 'Document verification failed.', 'DOCUMENT_INTEGRITY_ERROR');
  return takeawayDocumentSchema.parse(value.payload);
}

export async function createShare(
  tenantId: string,
  userId: string,
  input: { consultationId: string; recipientEmail: string; expiresHours?: number },
) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new ApiError(
      503,
      'Secure sharing needs the clinic email delivery service.',
      'EMAIL_UNAVAILABLE',
    );
  const origin = applicationUrl();
  const takeaway = await approvedTakeaway(tenantId, input.consultationId, userId);
  const configuration = await getDb().consultation.findUniqueOrThrow({
    where: { id: input.consultationId },
    include: { configurationVersion: true },
  });
  const config = clinicConfigurationSchema.parse(configuration.configurationVersion.payload);
  const hours = Math.min(
    input.expiresHours ?? config.retention.shareExpiryHours,
    config.retention.shareExpiryHours,
  );
  const token = secret();
  const expiry = new Date(
    Math.min(
      Date.now() + hours * 3600000,
      takeaway.expiresAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
    ),
  );
  const share = await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Consultation" WHERE "id" = ${input.consultationId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const current = await tx.consultation.findFirst({
      where: { id: input.consultationId, tenantId },
    });
    const snapshot = await tx.takeaway.findUnique({ where: { id: takeaway.id } });
    await requireResolvedEvidence(tx, tenantId, input.consultationId);
    if (
      !current ||
      !snapshot ||
      snapshot.revokedAt ||
      current.wellnessApprovedVersion !== takeaway.wellnessRevision ||
      current.wellnessRevision !== takeaway.wellnessRevision ||
      current.wellnessSummaryRevision !== current.summaryRevision ||
      current.wellnessCareRevision !== current.careRevision
    ) {
      throw new ApiError(409, 'The wellness plan changed. Review and approve it again.');
    }
    const link = await tx.shareLink.create({
      data: {
        tenantId,
        takeawayId: takeaway.id,
        tokenHash: hash(token),
        recipientEmail: input.recipientEmail.trim().toLowerCase(),
        createdById: userId,
        expiresAt: expiry,
      },
    });
    await tx.consultationEvent.create({
      data: {
        tenantId,
        consultationId: input.consultationId,
        userId,
        action: 'TAKEAWAY_SHARED',
        artifactRevision: takeaway.wellnessRevision,
        after: { shareId: link.id, expiresAt: expiry.toISOString() },
      },
    });
    return link;
  });
  return {
    id: share.id,
    url: `${origin}/share/${token}`,
    expiresAt: share.expiresAt.toISOString(),
    warning: sharingWarning,
  };
}

export async function revokeShare(
  tenantId: string,
  userId: string,
  shareId: string,
): Promise<void> {
  await getDb().$transaction(async (tx) => {
    const share = await tx.shareLink.findFirst({
      where: { id: shareId, tenantId },
      include: { takeaway: true },
    });
    if (!share) throw new ApiError(404, 'Share not found.');
    const revokedAt = new Date();
    await tx.shareLink.update({ where: { id: shareId }, data: { revokedAt } });
    await tx.shareSession.updateMany({
      where: { shareLinkId: shareId, revokedAt: null },
      data: { revokedAt },
    });
    await tx.consultationEvent.create({
      data: {
        tenantId,
        consultationId: share.takeaway.consultationId,
        userId,
        action: 'TAKEAWAY_SHARE_REVOKED',
        after: { shareId },
      },
    });
  });
}

export async function validShare(token: string) {
  if (!linkPattern.test(token)) throw new ApiError(404, 'This share is unavailable.');
  const link = await getDb().shareLink.findUnique({
    where: { tokenHash: hash(token) },
    include: { takeaway: { include: { consultation: true, tenant: true } } },
  });
  const now = new Date();
  if (
    !link ||
    link.revokedAt ||
    link.expiresAt <= now ||
    link.takeaway.revokedAt ||
    !link.takeaway.tenant.isActive ||
    (link.takeaway.expiresAt && link.takeaway.expiresAt <= now) ||
    link.takeaway.consultation.wellnessRevision !== link.takeaway.wellnessRevision ||
    link.takeaway.consultation.wellnessApprovedVersion !== link.takeaway.wellnessRevision ||
    link.takeaway.consultation.wellnessSummaryRevision !==
      link.takeaway.consultation.summaryRevision ||
    link.takeaway.consultation.wellnessCareRevision !== link.takeaway.consultation.careRevision
  )
    throw new ApiError(410, 'This share has expired or is no longer available.');
  if (await unresolvedEvidence(getDb(), link.tenantId, link.takeaway.consultationId)) {
    throw new ApiError(410, 'This document is being reviewed. Ask the clinic for a fresh approved share.', 'EVIDENCE_PROCESSING');
  }
  return link;
}

export async function sendShareCode(token: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new ApiError(
      503,
      'Email verification is unavailable. Contact the clinic.',
      'EMAIL_UNAVAILABLE',
    );
  const link = await validShare(token);
  await rateLimit(`share-send:${link.id}`, { limit: 5, windowMs: 3600000 });
  await rateLimit(`share-send-day:${link.id}`, { limit: 20, windowMs: 86400000 });
  const code = randomInt(100000, 1000000).toString();
  const challenge = secret();
  const expiresAt = new Date(Math.min(Date.now() + 600000, link.expiresAt.getTime()));
  const verification = await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "ShareLink" WHERE "id" = ${link.id}::uuid FOR UPDATE`;
    const current = await tx.shareLink.findUniqueOrThrow({ where: { id: link.id } });
    if (current.lastCodeSentAt && Date.now() - current.lastCodeSentAt.getTime() < 60000)
      throw new ApiError(429, 'Please wait a minute before requesting another code.');
    await tx.shareVerification.updateMany({
      where: { shareLinkId: link.id, verifiedAt: null },
      data: { expiresAt: new Date() },
    });
    await tx.shareLink.update({ where: { id: link.id }, data: { lastCodeSentAt: new Date() } });
    return tx.shareVerification.create({
      data: {
        shareLinkId: link.id,
        challengeHash: hash(challenge),
        codeHash: hash(`${challenge}:${code}`),
        expiresAt,
      },
    });
  });
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from: process.env.EMAIL_FROM,
      to: link.recipientEmail,
      subject: 'Your secure document access code',
      text: `Your access code is ${code}. It expires in 10 minutes. Enter it on the page where you requested it. Do not share this code. If you did not request access, ignore this message.`,
    },
    { idempotencyKey: `share-verification-${verification.id}` },
  );
  if (result.error || !result.data) {
    await getDb().shareVerification.update({
      where: { id: verification.id },
      data: { expiresAt: new Date() },
    });
    throw new ApiError(
      503,
      'The access code could not be delivered. Please try later or contact the clinic.',
      'EMAIL_DELIVERY_FAILED',
    );
  }
  (await cookies()).set(`dw-share-challenge-${link.id}`, challenge, {
    ...privateCookie,
    expires: expiresAt,
  });
}

export async function verifyShareCode(token: string, code: string): Promise<void> {
  const link = await validShare(token);
  await rateLimit(`share-verify:${link.id}`, { limit: 25, windowMs: 3600000 });
  const cookieStore = await cookies();
  const challenge = cookieStore.get(`dw-share-challenge-${link.id}`)?.value;
  if (!challenge || !linkPattern.test(challenge))
    throw new ApiError(401, 'Request a fresh access code.', 'CODE_REQUIRED');
  const sessionToken = secret();
  const expiresAt = new Date(Math.min(Date.now() + 3600000, link.expiresAt.getTime()));
  let matched = false;
  await getDb().$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; codeHash: string }>>`
      UPDATE "ShareVerification" SET "attempts" = "attempts" + 1
      WHERE "challengeHash" = ${hash(challenge)} AND "shareLinkId" = ${link.id}::uuid
        AND "expiresAt" > NOW() AND "verifiedAt" IS NULL AND "attempts" < 5
      RETURNING "id", "codeHash"
    `;
    if (!rows[0]) return;
    matched = timingSafeEqual(
      Buffer.from(rows[0].codeHash, 'hex'),
      Buffer.from(hash(`${challenge}:${code}`), 'hex'),
    );
    if (!matched) return;
    await tx.shareVerification.update({
      where: { id: rows[0].id },
      data: { verifiedAt: new Date() },
    });
    await tx.shareSession.create({
      data: { shareLinkId: link.id, tokenHash: hash(sessionToken), expiresAt },
    });
    await tx.consultationEvent.create({
      data: {
        tenantId: link.tenantId,
        consultationId: link.takeaway.consultationId,
        action: 'TAKEAWAY_RECIPIENT_VERIFIED',
        after: { shareId: link.id },
      },
    });
  });
  if (!matched)
    throw new ApiError(
      401,
      'The code is incorrect, expired, or has reached its attempt limit.',
      'INVALID_CODE',
    );
  cookieStore.delete(`dw-share-challenge-${link.id}`);
  cookieStore.set(`dw-share-session-${link.id}`, sessionToken, {
    ...privateCookie,
    expires: expiresAt,
  });
}

export async function sharedDocument(token: string): Promise<TakeawayDocument> {
  const link = await validShare(token);
  const sessionToken = (await cookies()).get(`dw-share-session-${link.id}`)?.value;
  if (!sessionToken || !linkPattern.test(sessionToken))
    throw new ApiError(
      401,
      'Verify your access code to open this document.',
      'RECIPIENT_VERIFICATION_REQUIRED',
    );
  const session = await getDb().shareSession.findUnique({
    where: { tokenHash: hash(sessionToken) },
  });
  if (
    !session ||
    session.shareLinkId !== link.id ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  )
    throw new ApiError(
      401,
      'Verify a fresh access code to reopen this document.',
      'RECIPIENT_VERIFICATION_REQUIRED',
    );
  return readTakeaway(link.takeaway);
}

export async function takeawayPdf(document: TakeawayDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  // Next's bundler can turn require.resolve into a virtual [project] path.
  // These installed assets are included in the route's output-file trace.
  const fontDirectory = join(process.cwd(), 'node_modules', 'geist', 'dist', 'fonts', 'geist-sans');
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(join(fontDirectory, 'Geist-Regular.ttf')),
    readFile(join(fontDirectory, 'Geist-Bold.ttf')),
  ]);
  const [regular, bold] = await Promise.all([
    pdf.embedFont(regularBytes, { subset: true }),
    pdf.embedFont(boldBytes, { subset: true }),
  ]);
  const supportedCharacters = new Set(regular.getCharacterSet());
  let representedGlyphs = false;
  const color = document.clinic.brandColor.slice(1);
  const accent = rgb(
    parseInt(color.slice(0, 2), 16) / 255,
    parseInt(color.slice(2, 4), 16) / 255,
    parseInt(color.slice(4, 6), 16) / 255,
  );
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  let pageNumber = 1;
  const gray = rgb(0.25, 0.3, 0.34);
  function newPage() {
    page = pdf.addPage([595.28, 841.89]);
    y = 790;
    pageNumber += 1;
  }
  function text(value: string, size = 11, strong = false, gap = 8) {
    const font = strong ? bold : regular;
    const width = 491;
    const printable = Array.from(value)
      .map((character) => {
        if (
          character === '\n' ||
          character === '\r' ||
          character === '\t' ||
          supportedCharacters.has(character.codePointAt(0)!)
        )
          return character;
        representedGlyphs = true;
        return `[U+${character.codePointAt(0)!.toString(16).toUpperCase()}]`;
      })
      .join('');
    for (const paragraph of printable.replace(/\r/g, '').split('\n')) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      const lines: string[] = [];
      let line = '';
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > width && line) {
          lines.push(line);
          line = '';
        }
        if (font.widthOfTextAtSize(word, size) > width) {
          if (line) {
            lines.push(line);
            line = '';
          }
          for (const character of word) {
            if (font.widthOfTextAtSize(line + character, size) > width) {
              lines.push(line);
              line = '';
            }
            line += character;
          }
        } else line = line ? `${line} ${word}` : word;
      }
      lines.push(line);
      for (const row of lines) {
        if (y < 70) newPage();
        page.drawText(row, { x: 52, y, size, font, color: strong ? accent : gray });
        y -= size * 1.45;
      }
      y -= gap;
    }
  }
  text(document.clinic.name, 23, true, 4);
  text('Your wellness visit', 17, true);
  text(
    `${new Date(document.visitDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}  ·  ${document.reference}`,
    10,
  );
  text('Your visit', 13, true, 4);
  text(document.visitSummary);
  text('Care received today', 13, true, 4);
  if (document.careOutcome === 'STARTED') {
    for (const item of document.careReceived)
      text(
        `${item.name}${item.quantity > 1 ? ` × ${item.quantity}` : ''}  ·  Catalog price ${priceLabel(item)}`,
        11,
      );
    if (!document.careReceived.length)
      text('Care started. Your clinic can provide the treatment details.');
  } else
    text(
      document.careOutcome === 'NOT_STARTED'
        ? 'Care was not started at this visit.'
        : 'Your clinic is confirming the care outcome.',
    );
  text('Your wellness recommendations', 13, true, 4);
  text(document.explanation);
  for (const item of document.offers) {
    text(item.name, 12, true, 3);
    if ('matchedGoals' in item && item.matchedGoals.length) {
      text('Goals you discussed', 11, true);
      for (const goal of item.matchedGoals) text(`• ${goal}`);
    }
    text(`Why it fits: ${item.rationale}`);
    if ('benefits' in item && item.benefits.length) {
      text('Included by your clinic', 11, true);
      for (const benefit of item.benefits) text(`• ${benefit}`);
    }
    text(`Total official price: ${priceLabel(item)} ${item.currency}`, 11, true);
    if (item.terms) text(`Clinic terms: ${item.terms}`, 10);
    text('Optional. Ask your clinic about this option if it interests you.', 10);
  }
  if (!document.offers.length) text('No additional services or memberships were recommended.');
  if (document.clinic.contact) {
    text('Your clinic', 13, true, 4);
    text(document.clinic.contact);
  }
  text(
    'Reviewed and approved by your clinic team. Suggestions describe options for discussion with your provider.',
    9,
  );
  text(document.warning, 8);
  if (representedGlyphs)
    text(
      'Characters outside the document font are preserved as their Unicode code point, for example [U+1F642]. The secure web document displays the original text.',
      8,
    );
  for (const [index, sheet] of pdf.getPages().entries())
    sheet.drawText(`DripWell · ${index + 1} / ${pageNumber}`, {
      x: 52,
      y: 30,
      size: 8,
      font: regular,
      color: gray,
    });
  pdf.setTitle('Your wellness visit');
  pdf.setCreator('DripWell');
  pdf.setProducer('DripWell');
  return pdf.save();
}
