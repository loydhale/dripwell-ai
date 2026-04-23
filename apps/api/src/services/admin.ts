import { prisma } from '@dripwell/shared';
import { NotFoundError, ForbiddenError } from '../lib/errors.js';
import type { FastifyInstance } from 'fastify';

interface GenerateImpersonationTokenParams {
  providerId: string;
  adminId: string;
  tenantId: string;
  fastify: FastifyInstance;
}

interface ImpersonationResult {
  token: string;
  provider: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
    isActive: boolean;
  };
  expiresAt: Date;
}

export async function generateImpersonationToken({
  providerId,
  adminId,
  tenantId,
  fastify,
}: GenerateImpersonationTokenParams): Promise<ImpersonationResult> {
  const provider = await prisma.user.findFirst({
    where: { id: providerId, tenantId },
  });

  if (!provider) {
    throw new NotFoundError('Provider');
  }

  if (!provider.isActive) {
    throw new ForbiddenError('Cannot impersonate a deactivated provider');
  }

  if (provider.role === 'SUPER_USER') {
    throw new ForbiddenError('Cannot impersonate a super user');
  }

  if (provider.role !== 'PROVIDER') {
    throw new ForbiddenError('Can only impersonate providers');
  }

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const token = fastify.jwt.sign({
    userId: provider.id,
    role: provider.role,
    tenantId: provider.tenantId,
    impersonatedBy: adminId,
  }, { expiresIn: '1h' });

  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: adminId,
      action: 'IMPERSONATION_STARTED',
      entityType: 'User',
      entityId: provider.id,
      impersonatedBy: adminId,
      details: {
        impersonatedProviderId: provider.id,
        impersonatedProviderEmail: provider.email,
        impersonatedProviderName: `${provider.firstName} ${provider.lastName}`,
      },
    },
  });

  return {
    token,
    provider: {
      id: provider.id,
      email: provider.email,
      firstName: provider.firstName,
      lastName: provider.lastName,
      role: provider.role,
      tenantId: provider.tenantId,
      isActive: provider.isActive,
    },
    expiresAt,
  };
}
