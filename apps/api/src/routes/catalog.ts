import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { parseBody } from '../lib/validate.js';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import type { UserPayload } from '../types/index.js';

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
      });

      return { items };
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
}
