import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { getDb } from '../../lib/db';
import { verifiedOwner } from '../lib/scope';

export default defineTool({
  description:
    'Read this verified owner’s official active configuration and recent draft versions. Read-only. Never query another clinic.',
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const { tenantId, locationId } = await verifiedOwner(ctx);
    const versions = await getDb().clinicConfigurationVersion.findMany({
      where: { tenantId, locationId },
      orderBy: { version: 'desc' },
      take: 3,
      select: { id: true, version: true, status: true, payload: true, activatedAt: true },
    });
    const active = await getDb().clinicConfigurationVersion.findFirst({
      where: { tenantId, locationId, status: 'ACTIVE' },
      select: { id: true, version: true, payload: true },
    });
    return JSON.parse(JSON.stringify({ active, versions })) as {
      active: unknown;
      versions: unknown[];
    };
  },
});
