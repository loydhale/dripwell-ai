import { publicUser, requireUser } from '@/lib/auth';
import { apiRoute, json } from '@/lib/http';

export const GET = apiRoute(async () => {
  const user = await requireUser();
  return json({ user: publicUser(user), clinic: user.tenant ? { id: user.tenant.id, name: user.tenant.name, slug: user.tenant.slug } : null, location: user.locationId ? { id: user.locationId } : null });
});
