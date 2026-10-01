import type { ToolContext } from 'eve/tools';
import { getDb } from '../../lib/db';

export async function verifiedOwner(ctx: Pick<ToolContext, 'session'>) {
  const caller = ctx.session.auth.current;
  const tenantId = caller?.attributes.tenantId;
  const userId = caller?.attributes.userId;
  const locationId = caller?.attributes.locationId;
  if (
    caller?.principalType !== 'user' ||
    caller.authenticator !== 'dripwell-session' ||
    typeof tenantId !== 'string' ||
    typeof userId !== 'string' ||
    caller.principalId !== `${tenantId}/${userId}`
  ) {
    throw new Error('OWNER_AUTHENTICATION_REQUIRED');
  }
  const user = await getDb().user.findFirst({
    where: {
      id: userId,
      tenantId,
      role: 'SUPER_USER',
      isActive: true,
      tenant: { is: { isActive: true } },
    },
    select: { id: true, tenantId: true },
  });
  if (!user?.tenantId) throw new Error('OWNER_AUTHORIZATION_REVOKED');
  if (
    typeof locationId !== 'string' ||
    !(await getDb().location.findFirst({
      where: { id: locationId, tenantId, isActive: true },
      select: { id: true },
    }))
  )
    throw new Error('LOCATION_AUTHORIZATION_REQUIRED');
  const binding = await getDb().setupConversation.findFirst({
    where: {
      eveSessionId: ctx.session.id,
      tenantId,
      userId,
      locationId,
      location: { is: { tenantId, isActive: true } },
    },
    select: { id: true },
  });
  if (!binding) throw new Error('SETUP_LOCATION_BINDING_REQUIRED');
  return { tenantId: user.tenantId, userId: user.id, locationId };
}
