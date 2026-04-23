import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';
import {
  parseCsvPreview,
  importCatalogItems,
  extractMenuFromImage,
  generateCatalogDescription,
} from '../services/catalog-import.js';

const createCatalogSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']),
  isInStock: z.boolean().optional(),
  outOfStockReason: z.string().optional(),
  stateRestrictions: z.record(z.any()).optional(),
});

const updateCatalogSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']).optional(),
  isInStock: z.boolean().optional(),
  outOfStockReason: z.string().optional(),
  stateRestrictions: z.record(z.any()).optional(),
  aiGeneratedDescription: z.boolean().optional(),
});

const importBodySchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']),
      description: z.string().optional(),
      ingredients: z.array(z.string()).default([]),
      price: z.number().optional(),
    })
  ),
  duplicateAction: z.enum(['UPDATE', 'SKIP']).default('SKIP'),
});

const generateDescriptionSchema = z.object({
  name: z.string().min(1),
  ingredients: z.array(z.string()).default([]),
  type: z.enum(['DRIP', 'ADD_ON', 'INJECTION', 'PEPTIDE']),
});

export default async function catalogRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/catalog',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const data = parseBody(createCatalogSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const item = await prisma.catalogItem.create({
        data: {
          tenantId: userPayload.tenantId,
          name: data.name,
          description: data.description,
          type: data.type,
          isInStock: data.isInStock ?? true,
          outOfStockReason: data.outOfStockReason,
          stateRestrictions: data.stateRestrictions,
        },
      });

      return { catalogItem: item };
    }
  );

  fastify.get(
    '/catalog',
    { preValidation: [fastify.authenticate] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const items = await prisma.catalogItem.findMany({
        where: {
          tenantId: userPayload.tenantId,
          isActive: true,
        },
        orderBy: { createdAt: 'desc' },
        include: {
          ingredients: {
            include: { ingredient: true },
          },
        },
      });

      const serialized = items.map((item) => ({
        ...item,
        ingredients: item.ingredients.map((ci) => ({
          id: ci.ingredient.id,
          name: ci.ingredient.name,
        })),
      }));

      return { items: serialized };
    }
  );

  fastify.put(
    '/catalog/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const data = parseBody(updateCatalogSchema)(request.body);
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const existing = await prisma.catalogItem.findFirst({
        where: { id, tenantId: userPayload.tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Catalog item');
      }

      const item = await prisma.catalogItem.update({
        where: { id },
        data: {
          ...data,
          stateRestrictions: data.stateRestrictions,
        },
      });

      if (data.isInStock === false && existing.isInStock) {
        await prisma.notification.create({
          data: {
            tenantId: userPayload.tenantId,
            title: 'Catalog item out of stock',
            message: `${item.name} is now marked as out of stock.${item.outOfStockReason ? ` Reason: ${item.outOfStockReason}` : ''}`,
            type: 'LOW_STOCK',
            entityId: item.id,
          },
        });
      }

      return { catalogItem: item };
    }
  );

  fastify.delete(
    '/catalog/:id',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const { id } = request.params as { id: string };
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const existing = await prisma.catalogItem.findFirst({
        where: { id, tenantId: userPayload.tenantId },
      });

      if (!existing) {
        throw new NotFoundError('Catalog item');
      }

      const item = await prisma.catalogItem.update({
        where: { id },
        data: { isActive: false },
      });

      return { catalogItem: item };
    }
  );

  // ---------------------------------------------------------------------------
  // CSV Import Preview
  // ---------------------------------------------------------------------------

  fastify.post(
    '/catalog/import-preview',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const data = await request.file();
      if (!data) {
        throw new ValidationError([{ message: 'CSV file is required' }]);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const mappingRaw = (data.fields.columnMapping as { value?: string } | undefined)?.value;
      let columnMapping: Record<string, string> | undefined;
      if (mappingRaw) {
        try {
          columnMapping = JSON.parse(mappingRaw) as Record<string, string>;
        } catch {
          throw new ValidationError([{ message: 'Invalid columnMapping JSON' }]);
        }
      }

      const preview = parseCsvPreview(buffer, columnMapping);

      return { preview };
    }
  );

  // ---------------------------------------------------------------------------
  // CSV Import Execute
  // ---------------------------------------------------------------------------

  fastify.post(
    '/catalog/import',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;
      const body = parseBody(importBodySchema)(request.body);

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const result = await importCatalogItems({
        tenantId: userPayload.tenantId,
        items: body.items,
        duplicateAction: body.duplicateAction,
      });

      await prisma.auditLog.create({
        data: {
          tenantId: userPayload.tenantId,
          userId: userPayload.userId,
          impersonatedBy: userPayload.impersonatedBy || null,
          action: 'CATALOG_UPDATED',
          entityType: 'CatalogItem',
          details: {
            action: 'bulk_import',
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            failed: result.failed,
          },
        },
      });

      return { result };
    }
  );

  // ---------------------------------------------------------------------------
  // Menu Photo Extraction
  // ---------------------------------------------------------------------------

  fastify.post(
    '/catalog/extract-menu',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const data = await request.file();
      if (!data) {
        throw new ValidationError([{ message: 'Menu image file is required' }]);
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const items = await extractMenuFromImage(buffer, data.mimetype);

      return { items };
    }
  );

  // ---------------------------------------------------------------------------
  // AI Description Generation
  // ---------------------------------------------------------------------------

  fastify.post(
    '/catalog/generate-description',
    { preValidation: [fastify.authenticate, fastify.requireRole(['SUPER_USER'])] },
    async (request) => {
      const userPayload = request.user as UserPayload;
      const body = parseBody(generateDescriptionSchema)(request.body);

      if (!userPayload.tenantId) {
        throw new ForbiddenError('User must belong to a tenant');
      }

      const description = await generateCatalogDescription({
        name: body.name,
        ingredients: body.ingredients,
        type: body.type,
      });

      return { description };
    }
  );
}
