import { getDb } from '@/lib/db';
import { json } from '@/lib/http';
import { serviceReadiness } from '@/lib/platform';
export const runtime = 'nodejs';
export async function GET() {
  const readiness = serviceReadiness();
  try {
    if (!readiness.configured)
      return json({ status: 'configuration-required', databaseReachable: false }, 503);
    await getDb().$queryRaw`SELECT 1`;
    return json({ status: 'ready', databaseReachable: true });
  } catch {
    return json({ status: 'unavailable', databaseReachable: false }, 503);
  }
}
